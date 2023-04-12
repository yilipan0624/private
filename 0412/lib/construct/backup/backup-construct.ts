import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';

type BackupConstructProps = {
  backupVaultName?: string;
  backupPlanName?: string;
  dailyBackupHour: number;
  dailyBackupMinute: number;
};

export class BackupConstruct extends Construct {
  public readonly backupVault: backup.CfnBackupVault;
  public readonly backupPlan: backup.CfnBackupPlan;

  constructor(scope: Construct, id: string, props: BackupConstructProps) {
    super(scope, id);

    // Create Backup Vault
    this.backupVault = new backup.CfnBackupVault(this, 'BackupVault', {
      backupVaultName: props.backupVaultName || 'testVaultName',
    });

    // Add tag to the Backup Vault
    cdk.Tags.of(this.backupVault).add('Name', props.backupVaultName || 'testVaultName');

    // Create Backup Plan Rule
     const backupPlanRule: backup.CfnBackupPlan.BackupRuleResourceTypeProperty = {
      ruleName: 'DailyBackup',
      scheduleExpression: `cron(${props.dailyBackupMinute} ${props.dailyBackupHour} * * ? *)`,
      targetBackupVault: this.backupVault.backupVaultName, // Use the BackupVault name as the target
};

    // Create a custom resource to wait for the BackupVault to be created
    const customResource = new cr.AwsCustomResource(this, 'CustomResource', {
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
      onUpdate: {
        service: 'Backup',
        action: 'describeBackupVault',
        parameters: {
          BackupVaultName: this.backupVault.backupVaultName,
        },
        physicalResourceId: cr.PhysicalResourceId.of('id'),
      },
    });

    // Add dependency between CustomResource and BackupVault
    customResource.node.addDependency(this.backupVault);

    // Create Backup Plan
    this.backupPlan = new backup.CfnBackupPlan(this, 'BackupPlan', {
      backupPlan: {
        backupPlanName: props.backupPlanName || 'testPlanName',
        backupPlanRule: [backupPlanRule],
      },
    });

    // Add dependency between Backup Plan and CustomResource
    this.backupPlan.node.addDependency(customResource);

    // Add tag to the Backup Plan
    cdk.Tags.of(this.backupPlan).add('Name', props.backupPlanName || 'testPlanName');

    // Create IAM Role
    const backupRole = new iam.Role(this, 'BackupRole', {
      assumedBy: new iam.ServicePrincipal('backup.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBackupServiceRolePolicyForBackup'),
      ],
    });

    // Backup selection for EBS volumes and S3
    const backupSelection = new backup.CfnBackupSelection(this, 'BackupSelection', {
      backupPlanId: this.backupPlan.ref,
      backupSelection: {
        selectionName: 'EBSVolumesAndS3',
        resources: [
          'arn:aws:ec2:*:*:volume/*',
          'arn:aws:s3:::*/*',
        ],
        iamRoleArn: backupRole.roleArn,
      },
    });
  }
}
