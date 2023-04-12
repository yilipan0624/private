import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_cloudwatch_actions as cw_actions } from 'aws-cdk-lib';


/**
 * AlarmLogsConstruct のプロパティ
 */
type AlarmLogsConstructProps = {
    metricName: string,
    metricNamespace: string
    logGroup: logs.ILogGroup;
    logFilterPatternStr: string;
    alarmTopic: sns.ITopic;
    alarmName?: string,
    alarmDescription?: string,
}

/**
 * CWLのアラームを作成
 */
export class AlarmLogsConstruct extends Construct {
    readonly metricFilter: logs.MetricFilter;
    readonly alarm: cw.Alarm;

    constructor(scope: Construct, id: string, props: AlarmLogsConstructProps) {
        super(scope, id);
        this.metricFilter = new logs.MetricFilter(this, 'MetricFilter',
            {
                filterPattern: { logPatternString: props.logFilterPatternStr },
                logGroup: props.logGroup,
                metricName: props.metricName,
                metricNamespace: props.metricNamespace,
            }
        );
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