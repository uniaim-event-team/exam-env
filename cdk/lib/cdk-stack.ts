import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as route53 from '@aws-cdk/aws-route53';

export interface CdkStackProps extends cdk.StackProps {
  prefix: string
  domain: string
  subDomains: string[]
  instanceCount: number
}


export class CdkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc
  public readonly hostedZone: route53.HostedZone

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
    this.hostedZone = new route53.HostedZone(this, 'HostedZone', {
      zoneName: props.domain,
    });

    // step server
    // note: need to add `${props.prefix}-step`.pem by aws console.
    const keyName = `${props.prefix}-step`
    const sgStep = new ec2.SecurityGroup(this, `${props.prefix}-sg-step`, {
      vpc: this.vpc
    })
    sgStep.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22))
    for (let i = 1; i <= 2; i++) {
      const subnetNum = (i + 1) % 2
      const stepInstance = new ec2.CfnInstance(this, `${props.prefix}-step${i}`, {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO).toString(),
        imageId: new ec2.AmazonLinuxImage({
          generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
          cpuType: ec2.AmazonLinuxCpuType.ARM_64
        }).getImage(this).imageId,
        subnetId: this.vpc.publicSubnets[subnetNum].subnetId,
        securityGroupIds: [sgStep.securityGroupId],
        keyName
      })
      stepInstance.tags.setTag('Name', `${props.prefix}-step${i}`)
    }
  }
}
