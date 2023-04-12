import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as synthetics from '@aws-cdk/aws-synthetics-alpha';
import * as path from 'path';


/**
 * SyntheticsConstruct のプロパティ
 */
type SyntheticsConstructProps = {
    /**
     * 通知先のSNSトピック
     */
    alarmTopic?: sns.ITopic;
    /**
     * アプリケーションエンドポイント
     * @example system.example.com
     */
    appEndpoint: string;
    /**
     * 監視対象のパス
     * @default /
     */
    appPath?: string;
    /**
     * Canary名
     * 文字数制限あり
     */
    canaryName?: string;
    /**
     * canaryS3Bucketの指定がない場合有効。
     */
    cannaryBucketName?: string;
    /**
     * 既存のCanaryS3Bucketを指定
     */
    canaryS3Bucket?: s3.IBucket;
    /**
     * アラーム名のプレフィックス文字列
     */
    canaryAlarmNamePrefixStr?: string;
    /**
     * Canary Functionの配置先
     */
    vpcSubnets?: {
        vpc: ec2.IVpc,
        subnets: ec2.ISubnet[]
    }
    /**
     * CDK自動削除
     */
    cdkAutoRemove?: boolean;
}

/**
 * Syntheticsと監視Alarmを作成
 */
export class SyntheticsConstruct extends Construct {
    public readonly canaryDurationAlarm: cw.Alarm;
    public readonly canaryFailedAlarm: cw.Alarm;

    constructor(scope: Construct, id: string, props: SyntheticsConstructProps) {
        super(scope, id);
        // Canaryバケット作成 or 参照
        const canaryS3Bucket = props.canaryS3Bucket || new s3.Bucket(this, `canaryArtifact`, {
            bucketName: props.cannaryBucketName,
            accessControl: s3.BucketAccessControl.PRIVATE,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: props.cdkAutoRemove ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
            enforceSSL: true,
        });

        // Canary 作成
        const appCanary = new synthetics.Canary(this, 'CanaryApp', {
            canaryName: props.canaryName,
            vpcSubnets: props.vpcSubnets ? { subnets: props.vpcSubnets.subnets } : undefined,
            vpc: props.vpcSubnets ? props.vpcSubnets.vpc : undefined,
            schedule: synthetics.Schedule.rate(cdk.Duration.minutes(5)),
            test: synthetics.Test.custom({
                code: synthetics.Code.fromAsset(path.join(__dirname, './canary-app')),
                handler: 'index.handler',
            }),
            runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_3_8,
            environmentVariables: {
                TARGETHOST: props.appEndpoint,
                TARGETPATH: props.appPath || '/',
            },
            artifactsBucketLocation: { bucket: canaryS3Bucket },
        });

        // Canary ロール作成
        appCanary.role.attachInlinePolicy(
            new iam.Policy(this, 'appCanalyPolicyToS3', {
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ['s3:GetBucketLocation'],
                        resources: [appCanary.artifactsBucket.bucketArn],
                    }),
                ],
            }),
        );

        // Create duration alarm (要件にない為、コメントアウト)
        // const durationAlarmName = props.canaryAlarmNamePrefixStr + '-dulation';
        // this.canaryDurationAlarm = appCanary
        //     .metricDuration({
        //         period: cdk.Duration.minutes(5),
        //         statistic: cw.Statistic.AVERAGE,
        //     })
        //     .createAlarm(this, 'canaryDuration', {
        //         evaluationPeriods: 5,
        //         datapointsToAlarm: 1,
        //         threshold: 400,
        //         comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        //         actionsEnabled: true,
        //         alarmName: durationAlarmName
        //     });
        // cdk.Tags.of(this.canaryDurationAlarm).add('Name', durationAlarmName);
        // this.canaryDurationAlarm.addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

        // Create failed run alarm
        const failedAlarmName = props.canaryAlarmNamePrefixStr + '-failed';
        this.canaryFailedAlarm = appCanary
            .metricFailed({
                period: cdk.Duration.minutes(5),
                statistic: cw.Statistic.AVERAGE,
            })
            .createAlarm(this, 'canaryFailed', {
                evaluationPeriods: 5,
                datapointsToAlarm: 1,
                threshold: 0,
                comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
                actionsEnabled: true,
                treatMissingData: cw.TreatMissingData.NOT_BREACHING,
                alarmName: failedAlarmName,
            });
        cdk.Tags.of(this.canaryFailedAlarm).add('Name', failedAlarmName);
        if (props.alarmTopic) {
            this.canaryFailedAlarm.addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));
        }
    }
}