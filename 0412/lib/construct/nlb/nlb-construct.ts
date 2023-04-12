import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';

/**
 * AlbConstruct プロパティ
 */
type NlbConstructProps = {
    /**
     * VPC
     */
    vpc: ec2.Vpc;
    /**
     * パブリックサブネット
     */    
    publicSubnets: ec2.ISubnet[];
    /**
     * NLB名
     */
    nlbName?: string;
    targetGroupName?: string,
    /** cdk Destroy した時に自動で削除するか(開発用) 。デフォルト:false */
    cdkAutoRemove?: boolean;
};



/**
 * パブリックNLBを作成
 */
export class NlbConstruct extends Construct {
    public readonly instanceProps: NlbConstructProps;
    public readonly nlb: elb.NetworkLoadBalancer;
    public readonly nlbListener: elb.NetworkListener;
    public readonly targetGroup: elb.NetworkTargetGroup;
    

    constructor(scope: Construct, id: string, props: NlbConstructProps) {
        super(scope, id);
        this.instanceProps = props;

        // NLB
        this.nlb = new elb.NetworkLoadBalancer(this, 'Nlb', {
            vpc: props.vpc,
            vpcSubnets: { subnets: props.publicSubnets },
            internetFacing: true,
            loadBalancerName: props.nlbName,
            crossZoneEnabled: true,
            deletionProtection: !props.cdkAutoRemove,
        });

        if (props.nlbName) {
            cdk.Tags.of(this.nlb).add('Name', props.nlbName);
        }
        
        this.targetGroup = new elb.NetworkTargetGroup(this, 'TargetGroup', {
            vpc: props.vpc,
            targetGroupName: props.targetGroupName,
            targetType: elb.TargetType.INSTANCE,
            protocol: elb.Protocol.TCP,
            port: 443, // 根据需要设置端口
        });

        // Listener
        this.nlbListener = this.nlb.addListener('NlbListener', {
            port: 80,
            defaultAction: elb.NetworkListenerAction.forward([this.targetGroup]),
        });
    }}