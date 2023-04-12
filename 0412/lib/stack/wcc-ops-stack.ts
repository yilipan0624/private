import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BackupConstruct } from '../construct/backup/backup-construct';
import { NamingStackProps } from '../../utils/commonTypes';
import { IamConstruct } from '../construct/iam/iam-construct';


/**
 * AWS Backup Stack properties
 */
type WccOpsStackProps = {
  namingStackProps: NamingStackProps;
  dailyBackupHour: number;
  dailyBackupMinute: number;
  backupVaultName?: string;
  backupPlanName?: string;
  roleName1: string;
  roleName2: string;
} & cdk.StackProps;
/**
 * AWS Backup Stack
 */
export class WccOpsStack extends cdk.Stack {
  readonly backupConstruct: BackupConstruct;

  constructor(scope: Construct, id: string, props: WccOpsStackProps) {
    super(scope, id, props);

    this.backupConstruct = new BackupConstruct(this, 'Backup-Construct', {
      backupVaultName: props.backupVaultName,
      backupPlanName: props.backupPlanName,
      dailyBackupHour: props.dailyBackupHour,
      dailyBackupMinute: props.dailyBackupMinute,
    });
  
    // 在堆栈中使用 IamConstruct
    const iamConstruct = new IamConstruct(this, 'IamConstruct', {
      roleName1: props.roleName1,
      roleName2: props.roleName2,
    });
  }
}