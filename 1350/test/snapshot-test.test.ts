import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import 'source-map-support/register';
import { ensureStr } from '../utils/helpers';
import { WccNetworkStack } from '../lib/stack/wcc-network-stack';
import { WccAppStatefullStack } from '../lib/stack/wcc-app-statefull-stack';
import { WccAppBackendStack } from '../lib/stack/wcc-app-backend-stack';
import { WccAppConnectionStack } from '../lib/stack/wcc-app-connection-stack';
import { WccOpsStack } from '../lib/stack/wcc-ops-stack';
import * as fs from 'fs';
import * as path from 'path';

class StackBuilder {
  public readonly networkStack: WccNetworkStack;
  public readonly appStatefullStack: WccAppStatefullStack;
  public readonly appBackendStack: WccAppBackendStack;
  public readonly appConnectionStack: WccAppConnectionStack;
  public readonly opsStack: WccOpsStack;

  constructor(envKey: string) {
    const cdkJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../cdk.json'), 'utf8'));
    const app = new cdk.App({ context: cdkJson['context'] });

    // ----------------------- Load context variables ------------------------------
    if (!envKey || envKey.length === 0) {
      throw new Error('Argument env is empty.');
    }
    const envVals = app.node.tryGetContext(envKey); // 環境パラメータ
    const pjPrefix = ensureStr(envVals['common'], 'pjPrefix');
    const region = ensureStr(envVals['common'], 'region');

    // CDK デフォルトアカウント & リージョン
    const procEnvDefault: cdk.Environment = {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: region || process.env.CDK_DEFAULT_REGION,
    };

    // ネーミング要素
    const namingStackProps = {
      envKey: envKey,
      pjPrefix: pjPrefix,
      systemId: 'ps',
    }

    //通知用SNS
    const snsAlarmTopicArn = envVals['common']['snsAlarmTopicArn'] || undefined;
    // dataSync用IAMロール
    const dataSyncRoleArnList = envVals['common']['dataSyncRoleArnList'] || undefined;
    // dataSync用クロスアカウント先ID
    const dataSyncCorssAccountId = envVals['common']['dataSyncCorssAccountId'] || undefined;
    // ----------------------- Environment variables for stack ------------------------------

    // ネットワークリソースを作成
    const networkStack = new WccNetworkStack(app, `${envKey}-${pjPrefix}-network`, {
      env: procEnvDefault,
      namingStackProps: { ...namingStackProps, increment: 1 },
      vpcCidr: ensureStr(envVals['network'], 'vpcCidr'),
      s3flowLogBucketArn: envVals['network']['s3flowLogBucketArn'] || undefined,
      publicSubnetsInfo: envVals['network']['publicSubnet'],
      privateSubnetsInfo: envVals['network']['privateSubnet'],
      dataSyncRoleArnList,
      dataSyncCorssAccountId,
    });
    cdk.Tags.of(networkStack).add('CTC_Bill02_System', `ps-${envKey}`);
    // ステートフルリソースを作成
    const appStatefullStack = new WccAppStatefullStack(app, `${envKey}-${pjPrefix}-appStatefull`, {
      env: procEnvDefault,
      namingStackProps: { ...namingStackProps, increment: 1 },
      vpc: networkStack.vpc,
      rdsInstaceTypeStr: ensureStr(envVals['appStatefull'], 'rdsInstaceTypeStr'),
      rdsBackupDays: envVals['appStatefull']['rdsBackupDays'] || undefined,
      rdsInstances: envVals['appStatefull']['rdsInstances'] || undefined,
      snsAlarmTopicArn,
      s3AccessLogBucket: networkStack.s3AccessLogBucket,
      dataSyncRoleArnList,
      dataSyncCorssAccountId,

    });
    appStatefullStack.addDependency(networkStack);
    cdk.Tags.of(appStatefullStack).add('CTC_Bill02_System', `ps-${envKey}`);

    // アプリケーション接続リソース（フロントエンド及びロードバランサー） を作成
    const appConnectionStack = new WccAppConnectionStack(app, `${envKey}-${pjPrefix}-appConnection`, {
      env: procEnvDefault,
      namingStackProps: { ...namingStackProps, increment: 1 },
      cloudFrontAccessLogBucketArn: envVals['appConnection']['cloudFrontAccessLogBucketArn'] || undefined,
      cloudFrontWebAclId: envVals['appConnection']['cloudFrontWebAclId'] || undefined,
      cloudFrontAcmArn: ensureStr(envVals['appConnection'], 'cloudFrontAcmArn'),
      frontDomainName: ensureStr(envVals['appConnection'], 'frontDomainName'),
      albAcmArn: ensureStr(envVals['appConnection'], 'albAcmArn'),
      backDomainName: ensureStr(envVals['appConnection'], 'backDomainName'),
      vpc: networkStack.vpc,
      albAccessLogbucketArn: envVals['appConnection']['albAccessLogbucketArn'] || undefined,
      snsAlarmTopicArn,
      s3AccessLogBucket: networkStack.s3AccessLogBucket,
    });
    cdk.Tags.of(appConnectionStack).add('CTC_Bill02_System', `ps-${envKey}`);

    // アプリケーションバックエンドリソースを作成
    const appBackendStack = new WccAppBackendStack(app, `${envKey}-${pjPrefix}-appBackend`, {
      env: procEnvDefault,
      namingStackProps: { ...namingStackProps, increment: 1 },
      vpc: networkStack.vpc,
      dbSecret: appStatefullStack.rds.rdsSecret,
      executedCheckupResultFilesBucket: appStatefullStack.executedCheckupResultFilesBucket,
      masterFilesBucket: appStatefullStack.masterFilesBucket,
      uploadCheckupResultFilesBucket: appStatefullStack.uploadCheckupResultFilesBucket,
      alb: appConnectionStack.alb,
      cloudFrontAccessPermissionHeader: appConnectionStack.cloudFrontAccessPermissionHeader,
      lemsProps: {
        cpu: 512,
        memoryLimitMiB: 1024,
        ecrRepository: appStatefullStack.ecrRepositoryLems,
        containerDesiredCount: 1,
        dockerTag: 'latest',
      },
      crcbProps: {
        cpu: 512,
        memoryLimitMiB: 1024,
        ecrRepository: appStatefullStack.ecrRepositoryCrcb,
        containerDesiredCount: 0,
        dockerTag: 'latest',
      },
      mubProps: {
        cpu: 512,
        memoryLimitMiB: 1024,
        ecrRepository: appStatefullStack.ecrRepositoryMub,
        containerDesiredCount: 0,
        dockerTag: 'latest',
      },
      snsAlarmTopicArn,
      dataSyncRoleArnList,
      dataSyncCorssAccountId,

    });
    appBackendStack.addDependency(networkStack);
    appBackendStack.addDependency(appStatefullStack);
    cdk.Tags.of(appBackendStack).add('CTC_Bill02_System', `ps-${envKey}`);


    //運用リソースを作成
    const opsStack = new WccOpsStack(app, `${envKey}-${pjPrefix}-ops`, {
      env: procEnvDefault,
      namingStackProps: { ...namingStackProps, increment: 1 },
      vpc: networkStack.vpc.vpc,
      privateSubnets: networkStack.vpc.privateSubnets || [],
    });
    cdk.Tags.of(opsStack).add('CTC_Bill02_System', `ps-${envKey}`);

    this.networkStack = networkStack;
    this.appStatefullStack = appStatefullStack;
    this.appBackendStack = appBackendStack;
    this.appConnectionStack = appConnectionStack;
    this.opsStack = opsStack;
  }
}


describe('snapshot-test-ctc1', () => {
  let stacks: StackBuilder;

  beforeAll(() => {
    stacks = new StackBuilder('ctc1');
  });

  test('networkStack', () => {
    const template = Template.fromStack(stacks.networkStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('appStatefullStack', () => {
    const template = Template.fromStack(stacks.appStatefullStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('appConnectionStack', () => {
    const template = Template.fromStack(stacks.appConnectionStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('appBackendStack', () => {
    const template = Template.fromStack(stacks.appBackendStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('opsStack', () => {
    const template = Template.fromStack(stacks.opsStack).toJSON();
    expect(template).toMatchSnapshot();
  });
});

describe('snapshot-test-dev', () => {
  let stacks: StackBuilder;

  beforeAll(() => {
    stacks = new StackBuilder('dev');
  });

  test('networkStack', () => {
    const template = Template.fromStack(stacks.networkStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('appStatefullStack', () => {
    const template = Template.fromStack(stacks.appStatefullStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('appConnectionStack', () => {
    const template = Template.fromStack(stacks.appConnectionStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('appBackendStack', () => {
    const template = Template.fromStack(stacks.appBackendStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('opsStack', () => {
    const template = Template.fromStack(stacks.opsStack).toJSON();
    expect(template).toMatchSnapshot();
  });
});

describe('snapshot-test-stg', () => {
  let stacks: StackBuilder;

  beforeAll(() => {
    stacks = new StackBuilder('stg');
  });

  test('networkStack', () => {
    const template = Template.fromStack(stacks.networkStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('appStatefullStack', () => {
    const template = Template.fromStack(stacks.appStatefullStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('appConnectionStack', () => {
    const template = Template.fromStack(stacks.appConnectionStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('appBackendStack', () => {
    const template = Template.fromStack(stacks.appBackendStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('opsStack', () => {
    const template = Template.fromStack(stacks.opsStack).toJSON();
    expect(template).toMatchSnapshot();
  });
});

describe('snapshot-test-pro', () => {
  let stacks: StackBuilder;

  beforeAll(() => {
    stacks = new StackBuilder('pro');
  });

  test('networkStack', () => {
    const template = Template.fromStack(stacks.networkStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('appStatefullStack', () => {
    const template = Template.fromStack(stacks.appStatefullStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('appConnectionStack', () => {
    const template = Template.fromStack(stacks.appConnectionStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('appBackendStack', () => {
    const template = Template.fromStack(stacks.appBackendStack).toJSON();
    expect(template).toMatchSnapshot();
  });
  test('opsStack', () => {
    const template = Template.fromStack(stacks.opsStack).toJSON();
    expect(template).toMatchSnapshot();
  });
});