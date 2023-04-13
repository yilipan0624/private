import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

/**
 * VpcPrivateSubnetConstruct のプロパティ
 */
type VpcPrivateSubnetConstructProps = {
    vpc: ec2.Vpc;
    cfnNatGateway: ec2.CfnNatGateway;
    subnetCidr: string;
    availabilityZone: string;
    subnetName?: string;
    routeTableName?: string;
}
/**
 * VpcPrivateSubnetConstruct
 */
export class VpcPrivateSubnetConstruct extends Construct {
    public readonly subnet: ec2.PrivateSubnet;
    public readonly routeTable: ec2.CfnRouteTable;

    constructor(scope: Construct, id: string, props: VpcPrivateSubnetConstructProps) {
        super(scope, id);

        // サブネット作成
        this.subnet = new ec2.PrivateSubnet(this, 'PrivateSubnet', {
            vpcId: props.vpc.vpcId,
            cidrBlock: props.subnetCidr,
            availabilityZone: props.availabilityZone,
        });

        // サブネットにNat Gateway ルートを追加
        this.subnet.addDefaultNatRoute(props.cfnNatGateway.ref);

        // Name タグを追加
        if (props.subnetName) {
            cdk.Tags.of(this.subnet).add('Name', props.subnetName, {
                includeResourceTypes: ['AWS::EC2::Subnet']
            });
        }
        if (props.routeTableName) {
            cdk.Tags.of(this.subnet).add('Name', props.routeTableName, {
                includeResourceTypes: ['AWS::EC2::RouteTable']
            });
        }
    }
}