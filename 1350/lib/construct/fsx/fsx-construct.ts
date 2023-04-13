import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as fsx from 'aws-cdk-lib/aws-fsx';
import { Construct } from 'constructs';
import { ADConstruct } from '../../construct/ad/ad-construct';

export interface FsxConstructProps {
  vpc: ec2.Vpc;
  uniqueAZPrivateSubnets: ec2.ISubnet[];
  directoryService: ADConstruct;
}

export class FsxConstruct extends Construct {
  constructor(scope: Construct, id: string, props: FsxConstructProps) {
    super(scope, id);

    // Create SecurityGroup 
    const fsxSecurityGroupName = 'MyFsxSecurityGroup';
    const fsxSecurityGroup = new ec2.SecurityGroup(this, 'fsxSecurityGroup', {
      vpc: props.vpc,
      securityGroupName: fsxSecurityGroupName,
      description: 'Security group for FSx',
    });
    cdk.Tags.of(fsxSecurityGroup).add('Name', fsxSecurityGroupName);

    // Add inbound rule
    fsxSecurityGroup.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(445), 'Allow FSx traffic');

    // Create FSx for Windows
    const fsxFileSystem = new fsx.CfnFileSystem(this, 'fsxFileSystem', {
      fileSystemType: 'WINDOWS',
      storageCapacity: 300,
      subnetIds: props.uniqueAZPrivateSubnets.map(subnet => subnet.subnetId),
      securityGroupIds: [fsxSecurityGroup.securityGroupId],
      windowsConfiguration: {
        activeDirectoryId: props.directoryService.directoryService.ref,
        throughputCapacity: 32,
        automaticBackupRetentionDays: 7,
        dailyAutomaticBackupStartTime: '01:00',
        weeklyMaintenanceStartTime: '1:01:00',
        deploymentType: 'MULTI_AZ_1',
        preferredSubnetId: props.uniqueAZPrivateSubnets[0].subnetId,
      },
    });

    // Output FSx DNS Name
    new cdk.CfnOutput(this, 'fsxDnsName', {
      value: fsxFileSystem.attrDnsName,
      description: 'FSx for Windows File System DNS Name',
    });
  }
}
