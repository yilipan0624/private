import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

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
 * 各種ファイル格納用S3バケットコンストラクトプロパティ
 */
type S3FileBucketConstructProps = {
    /**
     * バケット名
     */
    bucketName?: string;
    /**
     * アクセスログバケット
     */
    serverAccessLogsBucket?: s3.IBucket;
    eventBridgeEnabled?: boolean;
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
    /** cdk Destroy した時に自動で削除するか(開発用) 。デフォルト:false */
    cdkAutoRemove?: boolean;
}

/**
 * 各種ファイル格納用S3バケットコンストラクト
 */
export class S3FileBucketConstruct extends Construct {
    public readonly s3Bucket: s3.Bucket;
    constructor(scope: Construct, id: string, props: S3FileBucketConstructProps) {
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
            eventBridgeEnabled: props.eventBridgeEnabled,
            serverAccessLogsBucket: props.serverAccessLogsBucket,
            serverAccessLogsPrefix: props.serverAccessLogsBucket !== undefined ? `${props.bucketName}/` : undefined,
            removalPolicy: props.cdkAutoRemove ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
            lifecycleRules: lifecycleRules
        });
        if (props.bucketName) {
            cdk.Tags.of(this.s3Bucket).add('Name', props.bucketName);
        }
    }
}

