import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

/** 
 * サーバアクセスログ設定時にターゲットバケットにACLを書き込む為、
 * ターゲットバケットのACL無効化する為に下記ワークアラウンドを実装。
 * https://github.com/aws/aws-cdk/issues/19603
 */
export class s3Bucket extends s3.Bucket {
    constructor(scope: Construct, id: string, props?: s3.BucketProps) {
        super(scope, id, {
            ...props,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
        }
        );
    }
}
(s3Bucket.prototype as any)["allowLogDelivery"] = function (
    this: s3Bucket
) {
    return null;
};

/**
 * S3アクセスログ用S3バケットコンストラクトプロパティ
 */
type S3S3logBucketConstructProps = {
    /**
     * バケット名
     */
    bucketName?: string;
    /**
     * オブジェクト削除のライフサイクルポリシー
     */
    deleteObjectsLifeCyclePolicy?: {
        /**
         * ライフサイクル名
         */
        lifecycleName?: string,
        /**
         * 削除を実施する日数
         */
        expirationDays: number
    };
    /**
     * サーバアクセスログを出力するアカウントのID
     * サーバアクセスログを本バケットに出力する場合は必須
     * バケットポリシー制御に利用
     */
    serverAccessLogSourceAccountId?: string;
    /**
     * dataSync用ロールARN
     */
    dataSyncRoleArnList?: string[]
    /**
     * dataSyncクロスアカウントId
     * クロスアカウントでDatasyncする場合は必須
     */
    dataSyncCorssAccountId?: string
    /** cdk Destroy した時に自動で削除するか(開発用) 。デフォルト:false */
    cdkAutoRemove?: boolean;
}

/**
 * S3アクセスログ用S3バケットコンストラクト
 */
export class S3S3logBucketConstruct extends Construct {
    public readonly s3Bucket: s3.IBucket;
    public readonly bucketArn: string;
    constructor(scope: Construct, id: string, props: S3S3logBucketConstructProps) {
        super(scope, id);
        const lifecycleRules: s3.LifecycleRule[] = [];
        if (props.deleteObjectsLifeCyclePolicy) {
            lifecycleRules.push({
                id: props.deleteObjectsLifeCyclePolicy.lifecycleName,
                expiration: cdk.Duration.days(props.deleteObjectsLifeCyclePolicy.expirationDays),
                noncurrentVersionExpiration: cdk.Duration.days(props.deleteObjectsLifeCyclePolicy.expirationDays),
            });
        }
        this.s3Bucket = new s3Bucket(this, 's3Bucket', {
            bucketName: props.bucketName,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: {
                blockPublicAcls: true,
                blockPublicPolicy: true,
                ignorePublicAcls: true,
                restrictPublicBuckets: true
            },
            enforceSSL: true,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
            removalPolicy: props.cdkAutoRemove ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
            lifecycleRules: lifecycleRules
        });
        if (props.dataSyncRoleArnList && props.dataSyncRoleArnList.length > 1) {
            const principalList = props.dataSyncRoleArnList.map(v_ => new iam.ArnPrincipal(v_))
            this.s3Bucket.addToResourcePolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                principals: principalList,
                resources: [this.s3Bucket.bucketArn],
                actions: [
                    's3:GetBucketLocation',
                    's3:ListBucket',
                    's3:ListBucketMultipartUploads'
                ]
            }));
            this.s3Bucket.addToResourcePolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                principals: principalList,
                resources: [this.s3Bucket.bucketArn + '/*'],
                actions: [
                    's3:AbortMultipartUpload',
                    's3:DeleteObject',
                    's3:GetObject',
                    's3:ListMultipartUploadParts',
                    's3:PutObjectTagging',
                    's3:GetObjectTagging',
                    's3:PutObject'
                ]
            }));
            this.s3Bucket.addToResourcePolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                principals: [new iam.AccountPrincipal(props.dataSyncCorssAccountId)],
                resources: [this.s3Bucket.bucketArn],
                actions: [
                    's3:ListBucket',
                ]
            }));
        }
        if (props.serverAccessLogSourceAccountId) {
            this.s3Bucket.addToResourcePolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                principals: [new iam.ServicePrincipal('logging.s3.amazonaws.com')],
                resources: [this.s3Bucket.bucketArn + '/*'],
                actions: [
                    's3:PutObject',
                ],
                conditions: {
                    StringEquals: {
                        "aws:SourceAccount": props.serverAccessLogSourceAccountId
                    }
                }
            }));
        }
        if (props.bucketName) {
            cdk.Tags.of(this.s3Bucket).add('Name', props.bucketName);
        }
    }
}
