import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';

/**
* LogGroupConstructProps 
*/
type LogGroupConstructProps = {
  logGroupName: string;
  retention: logs.RetentionDays;
  metricName: string;
  metricNamespace: string;
  logFilterPatternStr: string;
  alarmTopic: sns.ITopic;
  alarmName?: string;
  alarmDescription?: string;
};

/**
* CloudWatch LogGroup construct
*/
export class LogGroupConstruct extends Construct {
  readonly logGroup: logs.LogGroup;
  readonly metricFilter: logs.MetricFilter;
  readonly alarm: cw.Alarm;

  constructor(scope: Construct, id: string, props: LogGroupConstructProps) {
    super(scope, id);
/**
* CWLのロググループを作成
*/
    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: props.logGroupName,
      retention: props.retention,
    });
    
/**
* CWLのアラームを作成
*/
    this.metricFilter = new logs.MetricFilter(this, 'MetricFilter', {
      filterPattern: { logPatternString: props.logFilterPatternStr },
      logGroup: this.logGroup,
      metricName: props.metricName,
      metricNamespace: props.metricNamespace,
    });

    this.alarm = new cw.Alarm(this, 'Alarm', {
      alarmName: props.alarmName,
      metric: this.metricFilter.metric(),
      alarmDescription: props.alarmDescription,
      evaluationPeriods: 1,
      threshold: 0,
      treatMissingData: cw.TreatMissingData.NOT_BREACHING,
      actionsEnabled: true,
    });

    this.alarm.addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));
  }
}