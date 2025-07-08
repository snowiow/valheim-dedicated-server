import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as backup from 'aws-cdk-lib/aws-backup';
import { Construct } from 'constructs';
import { Schedule } from 'aws-cdk-lib/aws-events';

export class ValheimDedicatedServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'ValheimVPC', {
      maxAzs: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const securityGroup = new ec2.SecurityGroup(this, 'ValheimSecurityGroup', {
      vpc,
      description: 'Security group for Valheim dedicated server',
      allowAllOutbound: true,
    });

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.udpRange(2456, 2458),
      'Valheim game ports'
    );

    const serverPasswordParam = ssm.StringParameter.fromSecureStringParameterAttributes(this, 'ValheimServerPassword', {
      parameterName: '/valheim/server-password',
    });

    const role = new iam.Role(this, 'ValheimInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    serverPasswordParam.grantRead(role);

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'yum update -y',
      'yum install -y docker',
      'systemctl start docker',
      'systemctl enable docker',
      'usermod -a -G docker ec2-user',
      'mkdir -p /opt/valheim/config /opt/valheim/data',
      'chown -R ec2-user:ec2-user /opt/valheim',
      `SERVER_PASS=$(aws ssm get-parameter --name "${serverPasswordParam.parameterName}" --with-decryption --query "Parameter.Value" --output text --region ${this.region})`,
      'docker run -d \\',
      '  --name valheim-server \\',
      '  --restart unless-stopped \\',
      '  -p 2456-2458:2456-2458/udp \\',
      '  -v /opt/valheim/config:/config \\',
      '  -v /opt/valheim/data:/opt/valheim \\',
      '  -e SERVER_NAME="racel" \\',
      '  -e WORLD_NAME="racelWorld" \\',
      '  -e SERVER_PASS="$SERVER_PASS" \\',
      '  -e SERVER_PUBLIC=false \\',
      '  -e CROSSPLAY=true \\',
      '  lloesche/valheim-server'
    );

    const instance = new ec2.Instance(this, 'ValheimInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3A, ec2.InstanceSize.MEDIUM),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      securityGroup,
      role,
      userData,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    const backupVault = new backup.BackupVault(this, 'ValheimBackupVault', {
      backupVaultName: 'valheim-server-backup-vault',
    });

    const backupPlan = new backup.BackupPlan(this, 'ValheimBackupPlan', {
      backupPlanName: 'valheim-server-backup-plan',
      backupVault,
      backupPlanRules: [
        new backup.BackupPlanRule({
          ruleName: 'DailyBackups',
          scheduleExpression: Schedule.cron({
            minute: '0',
            hour: '4',
            day: '*',
            month: '*',
            year: '*',
          }),
          deleteAfter: cdk.Duration.days(7),
          startWindow: cdk.Duration.hours(1),
          completionWindow: cdk.Duration.hours(2),
        }),
      ],
    });

    new backup.BackupSelection(this, 'ValheimBackupSelection', {
      backupPlan,
      resources: [
        backup.BackupResource.fromEc2Instance(instance),
      ],
      backupSelectionName: 'valheim-server-selection',
    });

    new cdk.CfnOutput(this, 'InstanceId', {
      value: instance.instanceId,
      description: 'EC2 Instance ID',
    });

    new cdk.CfnOutput(this, 'PublicIP', {
      value: instance.instancePublicIp,
      description: 'Public IP address',
    });

    new cdk.CfnOutput(this, 'ServerConnection', {
      value: `${instance.instancePublicIp}:2456`,
      description: 'Valheim server connection address',
    });

    new cdk.CfnOutput(this, 'BackupVaultName', {
      value: backupVault.backupVaultName,
      description: 'AWS Backup Vault name for Valheim server',
    });
  }
}
