#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkStack } from '../lib/cdk-stack';
import {readFileSync} from "fs";
import {ApplicationStack} from "../lib/application-stack";

const app = new cdk.App();
const propsBase = JSON.parse(readFileSync('./env.json', 'utf-8'))
const cdkStack = new CdkStack(app, 'CdkStack', propsBase);
new ApplicationStack(app, 'ApplicationStack', {
    ...propsBase,
    vpc: cdkStack.vpc,
    hostedZone: cdkStack.hostedZone
})