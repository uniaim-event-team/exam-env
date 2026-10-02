import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as route53 from '@aws-cdk/aws-route53';
import {IHostedZone} from "@aws-cdk/aws-route53";

export interface CdkStackProps extends cdk.StackProps {
  prefix: string
  domain: string
  subDomains: string[]
  instanceCount: number
  tempPriority: number
}


export class CdkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc
  public readonly hostedZone: IHostedZone

  constructor(scope: cdk.Construct, id: string, props: CdkStackProps) {
    super(scope, id, props);

    // VPC
    this.vpc = new ec2.Vpc(this, `vpc-${props.prefix}`, {
      cidr: "172.32.0.0/16",
      defaultInstanceTenancy: ec2.DefaultInstanceTenancy.DEFAULT,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      subnetConfiguration: [{
          cidrMask: 20,
          name: `${props.prefix}-public`,
          subnetType: ec2.SubnetType.PUBLIC,
        }, {
          cidrMask: 20,
          name: `${props.prefix}-private`,
          subnetType: ec2.SubnetType.PRIVATE,
        }
      ],
      natGateways: 2,
    });

    // Route53
    // this.hostedZone = new route53.HostedZone(this, 'HostedZone', {
    //   zoneName: props.domain,
    // });
    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'ExistingZone', {
      hostedZoneId: 'Z05804063942NY7OJC1A6', // 既存のHostedZone ID
      zoneName: 'gijutsu-kadai.xyz',            // ルートドメイン名
    });

    // step server
    // note: need to add `${props.prefix}-step`.pem by aws console.
    const sgStep = new ec2.SecurityGroup(this, `${props.prefix}-sg-step`, {
      vpc: this.vpc
    })
    sgStep.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22))
    for (let i = props.tempPriority + 1; i <= props.tempPriority + props.subDomains.length; i++) {
      const subnetNum = (i + 1) % 2
      if (i <= 16) {
        const keyName = `td-step`
        const stepInstance = new ec2.CfnInstance(this, `${props.prefix}-step${i.toString().padStart(2, '0')}`, {
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO).toString(),
          imageId: "ami-0d6c4a34641cd51d3",
          subnetId: this.vpc.publicSubnets[subnetNum].subnetId,
          securityGroupIds: [sgStep.securityGroupId],
          keyName
        })
        stepInstance.tags.setTag('Name', `${props.prefix}-step${i.toString().padStart(2, '0')}`)
      } else {
        const keyName = `td-step2`
        const stepInstance = new ec2.CfnInstance(this, `${props.prefix}-step${i.toString().padStart(2, '0')}`, {
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO).toString(),
          imageId: "ami-0f8f565aff0af885b",  // Amazon Linux 2023 AMI 2023.12.20260629.0 x86_64 HVM kernel-6.18
          subnetId: this.vpc.publicSubnets[subnetNum].subnetId,
          securityGroupIds: [sgStep.securityGroupId],
          keyName
        })
        stepInstance.tags.setTag('Name', `${props.prefix}-step${i.toString().padStart(2, '0')}`)
      }
    }
  }
}
