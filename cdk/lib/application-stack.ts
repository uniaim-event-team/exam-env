import * as cdk from '@aws-cdk/core';
import * as acm from "@aws-cdk/aws-certificatemanager";
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as route53 from '@aws-cdk/aws-route53';
import * as targets from "@aws-cdk/aws-route53-targets";

import {Vpc} from "@aws-cdk/aws-ec2";
import {ApplicationListener} from "@aws-cdk/aws-elasticloadbalancingv2";

export interface ApplicationStackProps extends cdk.StackProps {
  prefix: string
  domain: string
  subDomains: string[]
  instanceCount: number
  useCert: boolean
  vpc: Vpc
  hostedZone: route53.HostedZone
}


export class ApplicationStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    const domainName = props.domain;
    // security group for application
    const sgApp = new ec2.SecurityGroup(this, `${props.prefix}-sg-app`, {
      vpc: props.vpc
    })
    sgApp.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(5250))
    sgApp.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(22))
    // security group for alb
    const sgAlb = new ec2.SecurityGroup(this, `${props.prefix}-sg-alb`, {
      vpc: props.vpc
    })
    sgAlb.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(80))
    sgAlb.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(443))

    // load balancer
    const lb = new elbv2.ApplicationLoadBalancer(this, `${props.prefix}-alb`, {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: sgAlb
    });
    let httpListener: ApplicationListener | null = null
    let httpsListener: ApplicationListener | null = null

    // privateSubnetは偶奇で変更する
    const targetInstanceList = []
    let priority = 0;
    for (const subDomain of props.subDomains) {
      priority += 1
      const keyName = `${props.prefix}-${subDomain}`
      for (let i = 0; i < props.instanceCount; i++) {
        const appInstance = new ec2.CfnInstance(this, `${props.prefix}-${subDomain}-${i}`, {
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO).toString(),
          imageId: new ec2.AmazonLinuxImage({
            generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
            cpuType: ec2.AmazonLinuxCpuType.ARM_64
          }).getImage(this).imageId,
          subnetId: props.vpc.privateSubnets[i % 2].subnetId,
          securityGroupIds: [sgApp.securityGroupId],
          keyName
        })
        appInstance.tags.setTag('Name', `${props.prefix}-${subDomain}-${i}`)
        targetInstanceList.push(new elbv2.InstanceTarget(appInstance.ref))
      }
      // 外部からアクセスするのは最初の一件だけ
      const targetGroup = new elbv2.ApplicationTargetGroup(this, `${props.prefix}-${subDomain}-target-group`, {
        healthCheck: {
          healthyHttpCodes: '200',
          healthyThresholdCount: 2,
          interval: cdk.Duration.seconds(30),
          path: '/',
          timeout: cdk.Duration.seconds(5),
          unhealthyThresholdCount: 2,
        },
        port: 5250,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetGroupName: `${props.prefix}-${subDomain}-tg`,
        vpc: props.vpc,
        targets: [targetInstanceList[0]]
      });
      if (priority === 1) {
        httpListener = lb.addListener(`${props.prefix}-http`, {
          port: 80,
          defaultTargetGroups: [targetGroup],
          open: true
        });
        if (props.useCert) {
          const certificate = new acm.DnsValidatedCertificate(this, `${props.prefix}-site-cert`, {
            domainName: domainName,
            subjectAlternativeNames: ['*.' + domainName],
            hostedZone: props.hostedZone
          });
          httpsListener = lb.addListener(`${props.prefix}-https`, {
            port: 443,
            defaultTargetGroups: [targetGroup],
            certificates: [certificate],
            open: true
          });
        }
      }
      if (httpListener != null) {
        new elbv2.ApplicationListenerRule(this, `${props.prefix}-${subDomain}-http-rule`, {
          hostHeader: `${subDomain}.${props.domain}`,
          priority,
          listener: httpListener,
          targetGroups: [targetGroup]
        })
      }
      if (httpsListener != null) {
        new elbv2.ApplicationListenerRule(this, `${props.prefix}-${subDomain}-https-rule`, {
          hostHeader: `${subDomain}.${props.domain}`,
          priority,
          listener: httpsListener,
          targetGroups: [targetGroup]
        })
      }
      new route53.RecordSet(this, `${props.prefix}-${subDomain}-record-set`, {
        recordName: subDomain,
        recordType: route53.RecordType.A,
        target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(lb)),
        zone: props.hostedZone
      })
    }
  }
}
