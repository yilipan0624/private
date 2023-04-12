import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

/**
 * SnsTopicWithSubscriptionConstructProps 
 */
type SnsTopicWithSubscriptionConstructProps = {
  topicName: string;
  displayName?: string;
  emailSubscription?: string;
};

/**
 * SNS Topic With Subscription Construct
 */
export class SnsTopicWithSubscriptionConstruct extends Construct {
  readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: SnsTopicWithSubscriptionConstructProps) {
    super(scope, id);

    this.topic = new sns.Topic(this, 'Topic', {
      topicName: props.topicName,
      displayName: props.displayName,
    });


    if (props.emailSubscription) {
      const emailSubscription = new sns_subscriptions.EmailSubscription(props.emailSubscription);
      this.topic.addSubscription(emailSubscription);
    }
  }
}