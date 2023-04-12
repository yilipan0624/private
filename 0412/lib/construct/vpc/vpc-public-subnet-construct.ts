import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

/**
 * VpcPublicSubnetConstruct プロパティ
 */
type VpcPublicSubnetConstructProps = {
    vpc: ec2.Vpc;
    cfnIgw: ec2.CfnInternetGateway;
    subnetCidr: string;
    availabilityZone: string;
    subnetName?: string;
    routeTableName?: string;
    eipName?: string;
    natGatewayName?: string;
}

/**
 * パブリックサブネットを作成
 */
export class VpcPublicSubnetConstruct extends Construct {
    public readonly natGateway: ec2.CfnNatGateway;
    public readonly subnet: ec2.PublicSubnet;
    public readonly routeTable: ec2.CfnRouteTable;

    constructor(scope: Construct, id: string, props: VpcPublicSubnetConstructProps) {
        super(scope, id);

        this.subnet = new ec2.PublicSubnet(this, 'PublicSubnet', {
            vpcId: props.vpc.vpcId,
            cidrBlock: props.subnetCidr,
            availabilityZone: props.availabilityZone,
        });

        const eip = new ec2.CfnEIP(this, 'Eip', {
            domain: 'vpc'
        });

        this.natGateway = new ec2.CfnNatGateway(this, 'NatGateway', {
            subnetId: this.subnet.subnetId,
            allocationId: eip.attrAllocationId
        });

        // Name タグ
        this.subnet.addDefaultInternetRoute(props.cfnIgw.ref, props.cfnIgw);
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
        if (props.eipName) {
            cdk.Tags.of(eip).add('Name', props.eipName);
        }
        if (props.natGatewayName) {
            cdk.Tags.of(this.natGateway).add('Name', props.natGatewayName);
        }
    }
}