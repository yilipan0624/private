import * as cdk from 'aws-cdk-lib';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { NamingStackProps } from '../../../utils/commonTypes';
import { ResourceNameBuilder } from '../../../utils/helpers';


//EC2 Instanceのプロパティ
type Ec2InstanceConstructProps = {
    namingStackProps: NamingStackProps;
    vpc: ec2.IVpc;
    privateSubnets: ec2.ISubnet[];
    publicSubnets: ec2.ISubnet[];
    subnetSelection?: ec2.SubnetSelection;
    instanceType?: string;
    securityGroupName?: string;
    logGroupName?: string;
    cdkAutoRemove?: boolean;
    
}

//EC2 instance作成
export class Ec2InstanceConstruct extends Construct {

    readonly instance1: ec2.Instance;
    readonly instance2: ec2.Instance;
    readonly instaceType?: string;
    readonly ec2Logs: { [logType: string]: logs.ILogGroup };

    constructor(scope: Construct, id: string, props: Ec2InstanceConstructProps) {
        super(scope, id);
        //定数
        const httpsPort = 443;
        this.instaceType = props.instanceType || 't3.medium';
        const cloudwatchLogsExportsList = ['error'];

        // EC2 SecurityGroup#1
        const sg = new ec2.SecurityGroup(this, 'sg-ec2-1', {
            vpc: props.vpc,
            securityGroupName: props.securityGroupName,
            allowAllOutbound: true,
        });
        props.privateSubnets.forEach(v_ => {
            sg.addIngressRule(ec2.Peer.ipv4(v_.ipv4CidrBlock), ec2.Port.tcp(httpsPort), 'allow HTTPS port access.',);
        });
        if (props.securityGroupName) {
            cdk.Tags.of(sg).add('Name', props.securityGroupName);
        }
        
        // EC2 SecurityGroup#2
        const sgName2 = ResourceNameBuilder.makeResourceNameStr({
            serviceName: 'sg',
            use: '2',
            ...props.namingStackProps
        });
        const sg2 = new ec2.SecurityGroup(this, 'sg-ec2-bastion2', {
            vpc: props.vpc,
            securityGroupName: sgName2,
            allowAllOutbound: true
        });
        props.privateSubnets.forEach(subnet => {
        sg2.addIngressRule(ec2.Peer.ipv4(subnet.ipv4CidrBlock), ec2.Port.allTraffic(), 'Allow all traffic from private subnets');
        });

        // add 443 port
        sg2.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow TCP traffic on port 443');
                cdk.Tags.of(sg).add('Name', sgName2);

        // EC2 Instance#1
        const instanceName1 = ResourceNameBuilder.makeResourceNameStr({
            serviceName: 'ec2',
            use: 'bastion',
            ...props.namingStackProps
        }); 
        
        this.instance1 = new ec2.Instance(this, 'EC2-bastion', {
         vpc: props.vpc,
         vpcSubnets: { subnets: [props.privateSubnets[0]] },
         instanceType: new ec2.InstanceType(this.instaceType || 't3.medium'),
         machineImage: ec2.MachineImage.latestAmazonLinux({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 }),
         instanceName: instanceName1,
         securityGroup:sg2,
         blockDevices: [{
           deviceName: `/dev/xvda`,
           volume: ec2.BlockDeviceVolume.ebs(8, {
           encrypted: true,
           volumeType: ec2.EbsDeviceVolumeType.GP3,
           iops: 3000,
                   }),
                }]
            }
        );
        this.instance1.userData.addCommands(
            `hostnamectl set-hostname ${instanceName1}`,
            'echo "preserve_hostname: true" >> /etc/cloud/cloud.cfg',
            'timedatectl set-timezone Asia/Tokyo',
            'yum update -y',
            'yum install -y amazon-cloudwatch-agent',
            'systemctl start amazon-cloudwatch-agent',
            'systemctl enable amazon-cloudwatch-agent',
                // Add CloudWatch Agent configuration for memory monitoring
            'echo \'{"metrics":{"append_dimensions":{"InstanceId":"${aws:InstanceId}"},"metrics_collected":{"mem":{"measurement":["used_percent"]}}},"logs":{}}\' > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json',
            'systemctl start amazon-cloudwatch-agent',
            'systemctl enable amazon-cloudwatch-agent'
            );  
            
        const cfnInstance1 = this.instance1.node.defaultChild as ec2.CfnInstance;
          if (!(/^ctc[0-9]$/.test(props.namingStackProps.envKey))) {
          cfnInstance1.disableApiTermination = true;
          }            

        // EC2 Instance#2
        const instanceName2 = ResourceNameBuilder.makeResourceNameStr({
        serviceName: 'ec2',
        use: 'Sagyou',
            ...props.namingStackProps
        });   
       
        this.instance2 = new ec2.Instance(this, 'EC2-sagyou', {
         vpc: props.vpc,
         vpcSubnets: { subnets: [props.privateSubnets[1]] },
         instanceType: new ec2.InstanceType(this.instaceType || 't3.medium'),
         machineImage: ec2.MachineImage.latestWindows(ec2.WindowsVersion.WINDOWS_SERVER_2019_ENGLISH_FULL_BASE),
         instanceName: instanceName2,
         securityGroup:sg,
         blockDevices: [{
           deviceName: `/dev/xvda`,
           volume: ec2.BlockDeviceVolume.ebs(8, {
           encrypted: true,
           volumeType: ec2.EbsDeviceVolumeType.GP3,
           iops: 3000,
                   }),
                }]
            }
        );
        this.instance2.userData.addCommands(
            'Set-ExecutionPolicy Unrestricted -Force',
            'Import-Module AWS.Tools.Installer',
            'Install-AWSToolsModule AWS.Tools.EC2, AWS.Tools.CloudWatch -CleanUp',
            'Set-Location C:\\ProgramData\\Amazon\\AmazonCloudWatchAgent',
            'New-Item -Path . -Name "amazon-cloudwatch-agent.json" -ItemType "file" -Force',
            'Add-Content -Path ".\\amazon-cloudwatch-agent.json" -Value \'{"metrics":{"append_dimensions":{"InstanceId":"${aws:InstanceId}"},"metrics_collected":{"LogicalDisk":[{"measurement":["FreeSpace"],"resources":["C:"]}],"Memory":{"measurement":["% Committed Bytes In Use"]}}},"logs":{}}\'',
            'C:\\ProgramData\\Amazon\\AmazonCloudWatchAgent\\amazon-cloudwatch-agent.exe -config "C:\\ProgramData\\Amazon\\AmazonCloudWatchAgent\\amazon-cloudwatch-agent.json"'
        );
        
        const cfnInstance2 = this.instance2.node.defaultChild as ec2.CfnInstance;
          if (!(/^ctc[0-9]$/.test(props.namingStackProps.envKey))) {
          cfnInstance2.disableApiTermination = true;
          }        

        // Create Loggroup
        this.ec2Logs = {};
        cloudwatchLogsExportsList.forEach(v_ => {
        
        // Loggroup#1    
        const logs1_ = logs.LogGroup.fromLogGroupName(
        this,
        `Instance1${v_}Log`,
        `/aws/ec2/instance/${this.instance1.instanceId}/${v_}`
        );
 
        this.ec2Logs[`instance1${v_}`] = logs1_;
        logs1_.node.addDependency(this.instance1);
        
        // Loggroup#2
        const logs2_ = logs.LogGroup.fromLogGroupName(
        this,
        `Instance2${v_}Log`,
        `/aws/ec2/instance/${this.instance2.instanceId}/${v_}`
         );
        this.ec2Logs[`instance2${v_}`] = logs2_;
        logs2_.node.addDependency(this.instance2);

        });
        }

    /**
     * CPUアラームを追加
     * @param id
     * @param alarmTopic 通知するSNSトピック
     * @param thresholdRate CPU使用率のアラート閾値
     * @param alarmName アラーム名
     */
     
    // Cpu Ararm1 
    addCpuArarm1(id: string, alarmTopic: sns.ITopic, thresholdRate = 0.8, alarmName?: string) {
    const alarm1 = new cw.Alarm(this, id, {
        metric: new cw.Metric({
            namespace: 'AWS/EC2',
            metricName: 'CPUUtilization',
            dimensionsMap: {
                InstanceId: this.instance1.instanceId,
            },
            period: cdk.Duration.minutes(5),
            statistic: cw.Statistic.AVERAGE,
        }),
        evaluationPeriods: 5,
        datapointsToAlarm: 1,
        threshold: thresholdRate * 100,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
        treatMissingData: cw.TreatMissingData.BREACHING,
        alarmName,
    });
    if (alarmName) {
        cdk.Tags.of(alarm1).add('Name', alarmName);
    }
    alarm1.addAlarmAction(new cw_actions.SnsAction(alarmTopic));
    }
    
    // Cpu Ararm2 
    addCpuArarm2(id: string, alarmTopic: sns.ITopic, thresholdRate = 0.8, alarmName?: string) {
    const alarm2 = new cw.Alarm(this, id, {
        metric: new cw.Metric({
            namespace: 'AWS/EC2',
            metricName: 'CPUUtilization',
            dimensionsMap: {
                InstanceId: this.instance2.instanceId,
            },
            period: cdk.Duration.minutes(5),
            statistic: cw.Statistic.AVERAGE,
        }),
        evaluationPeriods: 5,
        datapointsToAlarm: 1,
        threshold: thresholdRate * 100,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
        treatMissingData: cw.TreatMissingData.BREACHING,
        alarmName,
    });
    if (alarmName) {
        cdk.Tags.of(alarm2).add('Name', alarmName);
    }
    alarm2.addAlarmAction(new cw_actions.SnsAction(alarmTopic));
    }




      /**
     * CPUアラームを追加
     * @param id
     * @param alarmTopic 通知するSNSトピック
     * @param thresholdRate CPU使用率のアラート閾値
     * @param alarmName アラーム名
     */
    // Memory Ararm1
    addMemoryAlarm(id: string, alarmTopic: sns.ITopic, thresholdRate = 0.8, alarmName?: string) {
    const alarm1 = new cw.Alarm(this, id, {
        metric: new cw.Metric({
            namespace: 'CWAgent',
            metricName: 'mem_used_percent',
            dimensionsMap: {
                InstanceId: this.instance1.instanceId,
            },
            period: cdk.Duration.minutes(5),
            statistic: cw.Statistic.AVERAGE,
        }),
        evaluationPeriods: 5,
        datapointsToAlarm: 1,
        threshold: thresholdRate * 100,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
        treatMissingData: cw.TreatMissingData.BREACHING,
        alarmName,
    });
    if (alarmName) {
        cdk.Tags.of(alarm1).add('Memory-Ararm1', alarmName);
    }
    alarm1.addAlarmAction(new cw_actions.SnsAction(alarmTopic));
    }

    // Memory Ararm2
    addMemoryAlarm2(id: string, alarmTopic: sns.ITopic, thresholdRate = 0.8, alarmName?: string) {
    const alarm2 = new cw.Alarm(this, id, {
        metric: new cw.Metric({
            namespace: 'CWAgent',
            metricName: 'mem_used_percent',
            dimensionsMap: {
                InstanceId: this.instance2.instanceId,
            },
            period: cdk.Duration.minutes(5),
            statistic: cw.Statistic.AVERAGE,
        }),
        evaluationPeriods: 5,
        datapointsToAlarm: 1,
        threshold: thresholdRate * 100,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
        treatMissingData: cw.TreatMissingData.BREACHING,
        alarmName,
    });
    if (alarmName) {
        cdk.Tags.of(alarm2).add('Name', alarmName);
    }
    alarm2.addAlarmAction(new cw_actions.SnsAction(alarmTopic));
    }   

    
}