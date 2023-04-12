import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NamingStackProps } from '../../utils/commonTypes'
import { ResourceNameBuilder } from '../../utils/helpers'
import { VpcConstruct } from '../construct/vpc/vpc-construct';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { AlbConstruct } from '../construct/alb/alb-construct';
import { S3S3logBucketConstruct } from '../construct/s3/s3-s3log-bucket-construct';
import { NlbConstruct } from '../construct/nlb/nlb-construct';



type WccAppConnectionStackProps = {
    namingStackProps: NamingStackProps;
    vpc: VpcConstruct;
    /**
     * ALB ACM ARN
     */
    albAcmArn: string;
    /**
     * ALB アクセスログバケット ARN
     */
    albAccessLogbucketArn?: string;
    /**
     * 監視用SNSトピック
     */
    snsAlarmTopicArn?: string;
    /**
     * アクセスログ格納用S3バケット
     */
    //domainName: string; 
    
    s3AccessLogBucket?: S3S3logBucketConstruct;
} & cdk.StackProps


export class WccAppConnectionStack extends cdk.Stack {
    /** ALB */
    public readonly alb: AlbConstruct;
    public readonly nlb: NlbConstruct; // 添加 NLB 属性
    //public readonly route53: Route53Construct;
    public readonly cloudFrontAccessPermissionHeader: { key: string, val: string };
    
    constructor(scope: Construct, id: string, props: WccAppConnectionStackProps) {
        super(scope, id, props);



        /** ALB */
        this.alb = new AlbConstruct(this, 'LemsALB', {
            acmArn: props.albAcmArn,
            albSgName: ResourceNameBuilder.makeResourceNameStr({
                serviceName: 'sg',
                use: 'alb',
                ...props.namingStackProps
            }),
            albName: ResourceNameBuilder.makeResourceNameStr({
                serviceName: 'alb',
                use: `lems`,
                ...props.namingStackProps
            }),
            vpc: props.vpc.vpc,
            publicSubnets: props.vpc.publicSubnets,
            cdkAutoRemove: /^ctc[0-9]$/.test(props.namingStackProps.envKey)
        });
        if (props.s3AccessLogBucket) {
            this.alb.addAccessLog({ accessLogBucket: props.s3AccessLogBucket.s3Bucket });
        }
        // Route53
    //this.route53 = new Route53Construct(this, 'Route53', {
    //    domainName: props.domainName,
    //    albDnsName: this.alb.alb.loadBalancerDnsName,  // 从 AlbConstruct 实例获取 ALB 的 DNS 名称
    //});      
    // NLB
    this.nlb = new NlbConstruct(this, 'Nlb', {
        vpc: props.vpc.vpc,
        publicSubnets: props.vpc.publicSubnets,
        nlbName: ResourceNameBuilder.makeResourceNameStr({
            serviceName: 'nlb',
            use: 'lems',
            ...props.namingStackProps
        }),
        cdkAutoRemove: /^ctc[0-9]$/.test(props.namingStackProps.envKey),
    });
    }
}