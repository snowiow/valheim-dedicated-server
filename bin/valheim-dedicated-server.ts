#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ValheimDedicatedServerStack } from '../lib/valheim-dedicated-server-stack';

const app = new cdk.App();
new ValheimDedicatedServerStack(app, 'ValheimDedicatedServerStack', {});
