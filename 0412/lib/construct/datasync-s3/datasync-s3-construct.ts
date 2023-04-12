import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as aws_logs from 'aws-cdk-lib/aws-logs';
import * as aws_datasync from 'aws-cdk-lib/aws-datasync';


/**
 * DatasyncS3Construct のプロパティ
 */
type DatasyncS3ConstructProps = {
    /**
     * スケジュール時間
     * @example 'cron(0 15 * * ? *)'
     */
    cronExpression: string,
    sourceS3BucketArn: string,
    targetS3BucketArn: string,
    logGroupName?: string,
    dataSyncName?: string,
    sourceBucketAccessRoleArn: string,
    targetBucketAccessRoleArn: string
}

/**
 * DatasyncS3を作成
 */
export class DatasyncS3Construct extends Construct {

    constructor(scope: Construct, id: string, props: DatasyncS3ConstructProps) {
        super(scope, id);
        const logsGroup = new aws_logs.LogGroup(this, 'Logs', {
            logGroupName: props.logGroupName
        })

        const sourceLocaltion = new aws_datasync.CfnLocationS3(this, 'SourceLocation', {
            s3BucketArn: props.sourceS3BucketArn,
            s3Config: {
                bucketAccessRoleArn: props.sourceBucketAccessRoleArn,

            }
        });
        const targetLocaltion = new aws_datasync.CfnLocationS3(this, 'TargetLocation', {
            s3BucketArn: props.targetS3BucketArn,
            s3Config: {
                bucketAccessRoleArn: props.targetBucketAccessRoleArn
            }
        });
        new aws_datasync.CfnTask(this, 'DatasyncS3', {
            sourceLocationArn: sourceLocaltion.attrLocationArn,
            destinationLocationArn: targetLocaltion.attrLocationArn,
            options: {
                transferMode: 'CHANGED',
                preserveDeletedFiles: 'PRESERVE',
                overwriteMode: 'ALWAYS',
                logLevel: 'BASIC',
                objectTags: 'PRESERVE'
            },
            schedule: {
                scheduleExpression: props.cronExpression,
            },
            cloudWatchLogGroupArn: logsGroup.logGroupArn,
            name: props.dataSyncName,
        });
    }
}