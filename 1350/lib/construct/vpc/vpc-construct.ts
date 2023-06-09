import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { VpcPrivateSubnetConstruct } from './vpc-private-subnet-construct';
import { VpcPublicSubnetConstruct } from './vpc-public-subnet-construct';
import { CfnNatGateway } from 'aws-cdk-lib/aws-ec2';
import { IBucket } from 'aws-cdk-lib/aws-s3';

export type VpcConstructProps = {
    vpcCidr: string;
    publicSubnets: PublicSubnetProps[],
    privateSubnets: PrivateSubnetProps[],
    vpcName?: string;
    igwName?: string;
}

export type AddS3FlowLogProps = {
    S3FlowLogName?: string;
    s3flowLogBucket: IBucket;
}

export type PublicSubnetProps = {
    subnetCidr: string;
    availabilityZone: string;
    subnetName?: string,
    routeTableName?: string,
    eipName?: string,
    natGatewayName?: string,
}

export type PrivateSubnetProps = {
    subnetCidr: string;
    availabilityZone: string;
    subnetName?: string,
    routeTableName?: string,
}

export class VpcConstruct extends Construct {
    public readonly vpc: ec2.Vpc;
    public readonly publicSubnets: ec2.Subnet[];
    public readonly privateSubnets: ec2.Subnet[];
    readonly uniqueAZPrivateSubnets: ec2.ISubnet[];

    constructor(scope: Construct, id: string, props: VpcConstructProps) {
        super(scope, id);

        this.vpc = new ec2.Vpc(this, 'Vpc', {
            vpcName: props.vpcName,
            cidr: props.vpcCidr,
            subnetConfiguration: [],
            enableDnsHostnames: true,
            enableDnsSupport: true
        });
        if (props.vpcName) {
            cdk.Tags.of(this.vpc).add('Name', props.vpcName);
        }

        const igw = new ec2.CfnInternetGateway(this, 'Igw', {});
        if (props.igwName) {
            cdk.Tags.of(igw).add('Name', props.igwName);
        }
        new ec2.CfnVPCGatewayAttachment(this, 'IgwAtt', {
            vpcId: this.vpc.vpcId,
            internetGatewayId: igw.ref,
        });

        const publicSubnetList: ec2.Subnet[] = [];
        const natGwMap: Map<string, CfnNatGateway> = new Map<string, CfnNatGateway>();
        props.publicSubnets.forEach((v_, i_) => {
            const publicSubnetConstruct = new VpcPublicSubnetConstruct(this, 'PublicSubnet' + i_, {
                availabilityZone: v_.availabilityZone,
                cfnIgw: igw,
                vpc: this.vpc,
                subnetCidr: v_.subnetCidr,
                subnetName: v_.subnetName,
                routeTableName: v_.routeTableName,
                eipName: v_.eipName,
                natGatewayName: v_.natGatewayName,
            });
            publicSubnetList.push(publicSubnetConstruct.subnet);
            natGwMap.set(v_.availabilityZone, publicSubnetConstruct.natGateway);
        });
        this.publicSubnets = publicSubnetList;

        const privateSubnetList: ec2.Subnet[] = [];
       props.privateSubnets.forEach((v_, i_) => {
        if (!natGwMap.has(v_.availabilityZone)) {
            throw new Error('プライベートサブネットに対応するAZのNatGatewayがありません。');
        }
        const natGw = natGwMap.get(v_.availabilityZone) as ec2.CfnNatGateway;
        const privateSubnetConstruct = new VpcPrivateSubnetConstruct(this, 'PrivateSubnet' + i_, {
            availabilityZone: v_.availabilityZone,
            vpc: this.vpc,
            subnetCidr: v_.subnetCidr,
            subnetName: v_.subnetName,
            routeTableName: v_.routeTableName,
            cfnNatGateway: natGw
        });
        privateSubnetList.push(privateSubnetConstruct.subnet);
    });
    this.privateSubnets = privateSubnetList;

    // Initialize uniqueAZPrivateSubnets
    this.uniqueAZPrivateSubnets = Array.from(
        new Set(privateSubnetList.map(subnet => subnet.availabilityZone))
    ).map(az => privateSubnetList.find(subnet => subnet.availabilityZone === az) as ec2.ISubnet);
}

addS3GatewayEndpoint(id: string) {
    this.vpc.addGatewayEndpoint(id, {
        service: ec2.GatewayVpcEndpointAwsService.S3,
        subnets: [{ subnets: this.publicSubnets }, { subnets: this.privateSubnets }]
    });
}

addEc2MessagesInterfaceEndpoint(id: string, subnets: ec2.SubnetSelection) {
    this.vpc.addInterfaceEndpoint(id, {
        service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
        subnets: subnets,
    });
}

addSsmInterfaceEndpoint(id: string, subnets: ec2.SubnetSelection) {
    this.vpc.addInterfaceEndpoint(id, {
        service: ec2.InterfaceVpcEndpointAwsService.SSM,
        subnets: subnets,
    });
}

addSsmMessagesInterfaceEndpoint(id: string, subnets: ec2.SubnetSelection) {
    this.vpc.addInterfaceEndpoint(id, {
        service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
        subnets: subnets,
    });
}

addS3FlowLog(id: string, props: AddS3FlowLogProps) {
    const flowlog = new ec2.FlowLog(this, 'vpcFlowLog', {
        flowLogName: props.S3FlowLogName,
        resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
        destination: ec2.FlowLogDestination.toS3(props.s3flowLogBucket, props.S3FlowLogName + '/'),
        maxAggregationInterval: ec2.FlowLogMaxAggregationInterval.ONE_MINUTE,
        trafficType: ec2.FlowLogTrafficType.ALL
    });
    if (props.S3FlowLogName) {
        cdk.Tags.of(flowlog).add('Name', props.S3FlowLogName);
    }
}}
    
