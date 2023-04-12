import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NamingStackProps } from '../../utils/commonTypes';
import { ResourceNameBuilder } from '../../utils/helpers';
import { S3ApplogBucketConstruct } from '../construct/s3/s3-applog-bucket-construct';
import { S3CloudtraillogBucketConstruct } from '../construct/s3/s3-cloudtraillog-bucket-construct';
import { S3FileBucketConstruct } from '../construct/s3/s3-file-bucket-construct';
import { S3WaflogBucketConstruct } from '../construct/s3/s3-waflog-bucket-construct';
import { S3S3logBucketConstruct } from '../construct/s3/s3-s3log-bucket-construct';

type WccStorageStackProps = {
  namingStackProps: NamingStackProps;
  /** datasync用IAMロール */
  dataSyncRoleArnList?: string[]
  /**
   * dataSyncクロスアカウントId
   * クロスアカウントでDatasyncする場合は必須
   */
  s3AccessLogBucket?: S3S3logBucketConstruct;
  /**
  * アクセスログ格納用S3バケット
  */
  dataSyncCorssAccountId?: string
} & cdk.StackProps

export class WccStorageStack extends cdk.Stack {
  public readonly s3ApplogLogBucket: S3ApplogBucketConstruct;
  public readonly s3CloudtrailLogBucket: S3CloudtraillogBucketConstruct;
  public readonly s3FileBucket: S3FileBucketConstruct;
  public readonly s3WafLogBucket: S3WaflogBucketConstruct;
  

  constructor(scope: Construct, id: string, props: WccStorageStackProps) {
    super(scope, id, props);

    // S3アプリケーションログ格納用バケット作成
    this.s3ApplogLogBucket = new S3ApplogBucketConstruct(this, 'S3AppLogBucket', {
      bucketName: ResourceNameBuilder.makeResourceNameStr({
        serviceName: 's3',
        use: 's3-applog',
        ...props.namingStackProps
      }),
      deleteObjectsLifeCyclePolicy: {
        expirationDays: 7,
        lifecycleName: ResourceNameBuilder.makeResourceNameStr({
          serviceName: 'lifecycle',
          use: 'applog',
          ...props.namingStackProps
        })
      },
      cdkAutoRemove: /^ctc[0-9]$/.test(props.namingStackProps.envKey) || false,
      serverAccessLogsBucket: props.s3AccessLogBucket?.s3Bucket,
    })

    // S3Cloudtraillログ格納用バケット作成
    this.s3CloudtrailLogBucket = new S3CloudtraillogBucketConstruct(this, 'S3CloudtrailLogBucket', {
      bucketName: ResourceNameBuilder.makeResourceNameStr({
        serviceName: 's3',
        use: 's3-cloudtraillog',
        ...props.namingStackProps
      }),
      deleteObjectsLifeCyclePolicy: {
        expirationDays: 7,
        lifecycleName: ResourceNameBuilder.makeResourceNameStr({
          serviceName: 'lifecycle',
          use: 'cloudtraillog',
          ...props.namingStackProps
        })
      },
      cdkAutoRemove: /^ctc[0-9]$/.test(props.namingStackProps.envKey) || false,
      serverAccessLogsBucket: props.s3AccessLogBucket?.s3Bucket,
    })

    // S3各種ファイル格納用バケット作成
    this.s3FileBucket = new S3FileBucketConstruct(this, 'S3FileBucket', {
      bucketName: ResourceNameBuilder.makeResourceNameStr({
        serviceName: 's3',
        use: 's3-file',
        ...props.namingStackProps
      }),
      deleteObjectsLifeCyclePolicy: {
        expirationDays: 7,
        lifecycleName: ResourceNameBuilder.makeResourceNameStr({
          serviceName: 'lifecycle',
          use: 'file',
          ...props.namingStackProps
        })
      },
      cdkAutoRemove: /^ctc[0-9]$/.test(props.namingStackProps.envKey) || false,
      serverAccessLogsBucket: props.s3AccessLogBucket?.s3Bucket,
    })
    
      // S3WAFログ格納用バケット作成
    this.s3WafLogBucket = new S3WaflogBucketConstruct(this, 'S3WafLogBucket', {
      bucketName: ResourceNameBuilder.makeResourceNameStr({
        serviceName: 's3',
        use: 's3-waflog',
        ...props.namingStackProps
      }),
      deleteObjectsLifeCyclePolicy: {
        expirationDays: 7,
        lifecycleName: ResourceNameBuilder.makeResourceNameStr({
          serviceName: 'lifecycle',
          use: 'waflog',
          ...props.namingStackProps
        })
      },
      cdkAutoRemove: /^ctc[0-9]$/.test(props.namingStackProps.envKey) || false,
      serverAccessLogsBucket: props.s3AccessLogBucket?.s3Bucket,
    })  
  }
}