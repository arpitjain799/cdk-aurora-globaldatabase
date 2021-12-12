import * as assertions from '@aws-cdk/assertions';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as _rds from '@aws-cdk/aws-rds';
import { App, Stack } from '@aws-cdk/core';
import { GolbalAuroraRDSMaster, GolbalAuroraRDSSlaveInfra, InstanceTypeEnum, MySQLtimeZone } from '../src/index';

const envTokyo = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ap-northeast-1' };
test('test create Matser RDS', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envTokyo });
  new GolbalAuroraRDSMaster(stack, 'GolbalAuroraRDS');
  assertions.Template.fromStack(stack).findResources('AWS::RDS::DBCluster');
  assertions.Template.fromStack(stack).hasResourceProperties('AWS::RDS::DBClusterParameterGroup', {
    Family: 'aurora-mysql5.7',
    Parameters: {
      time_zone: 'UTC',
    },
  });
  assertions.Template.fromStack(stack).hasResourceProperties('AWS::RDS::DBInstance', {
    PubliclyAccessible: false,
  });
});

test('test create Matser Vpc Public', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envTokyo });
  const VPCPublic = new ec2.Vpc(stack, 'defaultVpc', {
    natGateways: 0,
    maxAzs: 3,
    subnetConfiguration: [{
      cidrMask: 26,
      name: 'PublicVPC',
      subnetType: ec2.SubnetType.PUBLIC,
    }],
  });
  new GolbalAuroraRDSMaster(stack, 'GolbalAuroraRDS', { vpc: VPCPublic });
  assertions.Template.fromStack(stack).hasResourceProperties('AWS::EC2::Subnet', {
    MapPublicIpOnLaunch: true,
  });
  assertions.Template.fromStack(stack).hasResourceProperties('AWS::RDS::DBInstance', {
    PubliclyAccessible: true,
  });
});

test('test update Parameter Group', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envTokyo });;
  new GolbalAuroraRDSMaster(stack, 'GolbalAuroraRDS', {
    parameters: {
      time_zone: MySQLtimeZone.ASIA_TAIPEI,
    },
  });
  assertions.Template.fromStack(stack).hasResourceProperties('AWS::RDS::DBClusterParameterGroup', {
    Parameters: {
      time_zone: 'Asia/Taipei',
    },
  });
});

test('test update timeZone', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envTokyo });;
  new GolbalAuroraRDSMaster(stack, 'GolbalAuroraRDS', {
    timeZone: MySQLtimeZone.ASIA_TAIPEI,
  });
  assertions.Template.fromStack(stack).hasResourceProperties('AWS::RDS::DBClusterParameterGroup', {
    Parameters: {
      time_zone: 'Asia/Taipei',
    },
  });
});

test('test change default dbUserName and default database Name', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envTokyo });;
  new GolbalAuroraRDSMaster(stack, 'GolbalAuroraRDS', {
    dbUserName: 'superuser',
    defaultDatabaseName: 'superdb',
    rdsPassword: '1qaz2wsx',
  });
  assertions.Template.fromStack(stack).hasResourceProperties('AWS::RDS::DBCluster', {
    Engine: 'aurora-mysql',
    DatabaseName: 'superdb',
    EngineVersion: '5.7.mysql_aurora.2.07.1',
    MasterUsername: 'superuser',
    MasterUserPassword: '1qaz2wsx',
  });
});

test('test no default rdsPassword', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envTokyo });;
  new GolbalAuroraRDSMaster(stack, 'GolbalAuroraRDS', {
    defaultDatabaseName: 'superdb',
  });
  assertions.Template.fromStack(stack).hasResourceProperties('AWS::RDS::DBCluster', {
    Engine: 'aurora-mysql',
    DatabaseName: 'superdb',
    EngineVersion: '5.7.mysql_aurora.2.07.1',
    MasterUsername: {
      'Fn::Join': [
        '',
        [
          '{{resolve:secretsmanager:',
          {
            Ref: 'GolbalAuroraRDSRDSClusterSecret55AE520F',
          },
          ':SecretString:username::}}',
        ],
      ],
    },
    MasterUserPassword: {
      'Fn::Join': [
        '',
        [
          '{{resolve:secretsmanager:',
          {
            Ref: 'GolbalAuroraRDSRDSClusterSecret55AE520F',
          },
          ':SecretString:password::}}',
        ],
      ],
    },
  });
});

test('test create Slave region vpc', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envTokyo });
  new GolbalAuroraRDSSlaveInfra(stack, 'GolbalAuroraRDS');
  assertions.Template.fromStack(stack).findResources('AWS::EC2::VPC');
});

test('test create Slave region use self vpc', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envTokyo });
  const rdsVpcSecond = new ec2.Vpc(stack, 'RDSVpcRegionSlave', {
    cidr: '10.109.0.0/16',
    enableDnsHostnames: true,
    enableDnsSupport: true,
    natGateways: 1,
  });
  new GolbalAuroraRDSSlaveInfra(stack, 'GolbalAuroraRDS', {
    vpc: rdsVpcSecond,
  });
  assertions.Template.fromStack(stack).findResources('AWS::EC2::VPC');
});

test('test create Slave region vpc default Private Subnet', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envTokyo });
  new GolbalAuroraRDSSlaveInfra(stack, 'GolbalAuroraRDS');
  assertions.Template.fromStack(stack).hasResourceProperties('AWS::RDS::DBSubnetGroup', {
    DBSubnetGroupDescription: 'Private Subnets for database',
  });
});


test('test create Slave region vpc use Public Subnet', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envTokyo });
  new GolbalAuroraRDSSlaveInfra(stack, 'GolbalAuroraRDS', {
    subnetType: ec2.SubnetType.PUBLIC,
  });
  assertions.Template.fromStack(stack).hasResourceProperties('AWS::RDS::DBSubnetGroup', {
    DBSubnetGroupDescription: 'Public Subnets for database',
  });
});

test('test create Main region vpc use Postgres cluster', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envTokyo });
  new GolbalAuroraRDSMaster(stack, 'GolbalAuroraRDS', {
    instanceType: InstanceTypeEnum.R5_LARGE,
    rdsPassword: '1qaz2wsx',
    engineVersion: _rds.DatabaseClusterEngine.auroraPostgres({ version: _rds.AuroraPostgresEngineVersion.VER_11_7 }),
    dbClusterpPG: new _rds.ParameterGroup(stack, 'dbClusterparametergroup', {
      engine: _rds.DatabaseClusterEngine.auroraPostgres({
        version: _rds.AuroraPostgresEngineVersion.VER_11_7,
      }),
      parameters: {
        'rds.force_ssl': '1',
        'timezone': 'UTC+8',
      },
    }),
  });
  assertions.Template.fromStack(stack).hasResourceProperties('AWS::RDS::DBCluster', {
    Engine: 'aurora-postgresql',
    DatabaseName: 'globaldatabase',
    MasterUsername: 'sysadmin',
    MasterUserPassword: '1qaz2wsx',
  });
  assertions.Template.fromStack(stack).hasResourceProperties('AWS::RDS::DBClusterParameterGroup', {
    Parameters: {
      'timezone': 'UTC+8',
      'rds.force_ssl': '1',
    },
  });
});

test('test Create Custom Resource', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envTokyo });
  new GolbalAuroraRDSMaster(stack, 'GolbalAuroraRDS', {
    instanceType: InstanceTypeEnum.R5_LARGE,
    rdsPassword: '1qaz2wsx',
    engineVersion: _rds.DatabaseClusterEngine.auroraPostgres({ version: _rds.AuroraPostgresEngineVersion.VER_11_7 }),
    dbClusterpPG: new _rds.ParameterGroup(stack, 'dbClusterparametergroup', {
      engine: _rds.DatabaseClusterEngine.auroraPostgres({
        version: _rds.AuroraPostgresEngineVersion.VER_11_7,
      }),
    }),
  });
  assertions.Template.fromStack(stack).findResources('Custom::UpgradeGlobalClusterProvider');
});

test('test add Regional Function', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envTokyo });
  const globalmainstack = new GolbalAuroraRDSMaster(stack, 'GolbalAuroraRDS', {
    instanceType: InstanceTypeEnum.R5_LARGE,
    rdsPassword: '1qaz2wsx',
    engineVersion: _rds.DatabaseClusterEngine.auroraPostgres({ version: _rds.AuroraPostgresEngineVersion.VER_11_7 }),
    dbClusterpPG: new _rds.ParameterGroup(stack, 'dbClusterparametergroup', {
      engine: _rds.DatabaseClusterEngine.auroraPostgres({
        version: _rds.AuroraPostgresEngineVersion.VER_11_7,
      }),
    }),
  });

  globalmainstack.addRegionalCluster(stack, 'regional', {
    region: 'ap-southeast-1',
    dbSubnetGroupName: 'mock-db-subnet-group-name',
  });

  assertions.Template.fromStack(stack).findResources('Custom::UpgradeGlobalClusterProvider');
  assertions.Template.fromStack(stack).findResources('Custom::addRegionalClusterProvider');
});

const envErrorRegion = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'sa-east-1' };
test('test error Region', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envErrorRegion });
  expect(()=>{
    const globalmainstack = new GolbalAuroraRDSMaster(stack, 'GolbalAuroraRDS', {
      instanceType: InstanceTypeEnum.R5_LARGE,
      rdsPassword: '1qaz2wsx',
      engineVersion: _rds.DatabaseClusterEngine.auroraPostgres({ version: _rds.AuroraPostgresEngineVersion.VER_11_7 }),
      dbClusterpPG: new _rds.ParameterGroup(stack, 'dbClusterparametergroup', {
        engine: _rds.DatabaseClusterEngine.auroraPostgres({
          version: _rds.AuroraPostgresEngineVersion.VER_11_7,
        }),
      }),
    });

    globalmainstack.addRegionalCluster(stack, 'regional', {
      region: 'ap-southeast-1',
      dbSubnetGroupName: 'mock-db-subnet-group-name',
    });
  }).toThrowError(/This region sa-east-1 not Support Global RDS !!!/);
});

test('test error Region input addRegional Function', () => {
  const app = new App();
  const stack = new Stack(app, 'testing-stack', { env: envErrorRegion });
  expect(()=>{
    new GolbalAuroraRDSSlaveInfra(stack, 'GolbalAuroraRDS');
    assertions.Template.fromStack(stack).findResources('AWS::EC2::VPC');
  }).toThrowError(/This region sa-east-1 not Support Global RDS !!!/);
});