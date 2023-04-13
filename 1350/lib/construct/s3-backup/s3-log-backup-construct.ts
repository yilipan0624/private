import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3  from 'aws-cdk-lib/aws-s3';
import * as iam  from 'aws-cdk-lib/aws-iam';
import * as khfDestination from '@aws-cdk/aws-kinesisfirehose-destinations-alpha';
import * as kfh from '@aws-cdk/aws-kinesisfirehose-alpha';
import * as kinesis  from 'aws-cdk-lib/aws-kinesis';
import * as logsDestinations from 'aws-cdk-lib/aws-logs-destinations';
import { Construct } from 'constructs';


/**
 * LogsS3BackupConstruct のプロパティ
 */
type LogsS3BackupConstructProps = {
    /**
     * 出力先のS3バケット
     */
    destinationBucket: s3.IBucket;
    /**
     * 入力元のCloudWatchLogs Gropu
     */
    sourceLogGroup: logs.ILogGroup;
    /**
     * デリバリーストリーム名
     */
    deliveryStreamName?: string;
    /**
     * ストリーム名
     */
    streamName?: string;
}

/**
 * CWLからS3BucketへログをバックアップするKFHを作成する
 */
export class LogsS3BackupConstruct extends Construct {

    constructor(scope: Construct, id: string, props: LogsS3BackupConstructProps) {
        super(scope, id);
        const sourceStream = new kinesis.Stream(this, 'SourceStream', {
            encryption: kinesis.StreamEncryption.MANAGED,
            streamName: props.streamName
        });
        if (props.streamName) {
            cdk.Tags.of(sourceStream).add('Name', props.streamName);
        }

        const outputPrefix = props.sourceLogGroup.logGroupName.replace(/\//g, '-').replace(/^-/, '');
        const destination = new khfDestination.S3Bucket(props.destinationBucket, {
            bufferingInterval: cdk.Duration.seconds(900),
            dataOutputPrefix: outputPrefix + '/',
            logging: true,
        });

        const deliveryStream = new kfh.DeliveryStream(this, 'DeliveryStream', {
            destinations: [destination],
            sourceStream: sourceStream,
            deliveryStreamName: props.deliveryStreamName
        });
        if (props.deliveryStreamName) {
            cdk.Tags.of(deliveryStream).add('Name', props.deliveryStreamName);
        }

        const subscriptionFilterRole = new iam.Role(this, 'SubscriptionFilterRole', {
            assumedBy: new iam.ServicePrincipal(`logs.amazonaws.com`),
        });
        const subscriptionFilter = props.sourceLogGroup.addSubscriptionFilter('SubscriptionFilter', {
            destination: new logsDestinations.KinesisDestination(sourceStream, { role: subscriptionFilterRole }),
            filterPattern: logs.FilterPattern.allEvents(),
        });
        // deliveryStream.grantPutRecords(subscriptionFilterRole).applyBefore(subscriptionFilter);
        subscriptionFilterRole.grantPassRole(subscriptionFilterRole).applyBefore(subscriptionFilter);

    }
}