import * as cdk from 'aws-cdk-lib';
import * as directoryservice from 'aws-cdk-lib/aws-directoryservice';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { NamingStackProps } from '../../../utils/commonTypes';

type ADConstructProps = {
    namingStackProps: NamingStackProps;
    vpc: ec2.IVpc;
    uniqueAZPrivateSubnets: ec2.ISubnet[];
    password: cdk.SecretValue;
    domainName?: string;
};

export class ADConstruct extends Construct {
    public readonly directoryService: directoryservice.CfnMicrosoftAD;

    constructor(scope: Construct, id: string, props: ADConstructProps) {
        super(scope, id);

        const domainName = props.domainName || 'yilipan.local';
    
        this.directoryService = new directoryservice.CfnMicrosoftAD(this, 'ManagedMicrosoftAD', {
            name: domainName,
            password: props.password.toString(),
            vpcSettings: {
                vpcId: props.vpc.vpcId,
                subnetIds: props.uniqueAZPrivateSubnets.map(subnet => subnet.subnetId),
            },
            edition: 'Standard',
        });
    }
}