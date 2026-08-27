import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const template = readFileSync(
    resolve(process.cwd(), 'infra/dedicated-staging/dedicated-staging.yaml'),
    'utf8',
)
const isolatedRunbook = readFileSync(
    resolve(process.cwd(), 'docs/deploy/isolated-staging-foundation.md'),
    'utf8',
)
const browserConfig = readFileSync(
    resolve(process.cwd(), 'playwright.homepage.config.ts'),
    'utf8',
)
const stagingRunner = readFileSync(
    resolve(process.cwd(), 'scripts/staging/isolated-staging.ts'),
    'utf8',
)

const resourceSection = (start: string, end: string) => {
    const startIndex = template.indexOf(start)
    const endIndex = template.indexOf(end, startIndex + start.length)

    expect(startIndex).toBeGreaterThan(-1)
    expect(endIndex).toBeGreaterThan(startIndex)

    return template.slice(startIndex, endIndex)
}

describe('dedicated Staging outbound network contract', () => {
    it('keeps the workload private and gives it one explicit NAT-backed path', () => {
        expect(template).toContain('Type: AWS::EC2::NatGateway')
        expect(template).toContain('ConnectivityType: public')
        expect(template).toContain('MapPublicIpOnLaunch: false')
        expect(template).toContain('AssociatePublicIpAddress: false')
        expect(template).not.toContain('\n  StagingElasticIp:')
        expect(template).not.toContain('\n  StagingElasticIpAssociation:')
        expect(template).not.toContain('\n  ElasticIpAddress:')
        expect(template).not.toMatch(
            /Type: AWS::EC2::EIPAssociation[\s\S]*?InstanceId: !Ref StagingInstance/,
        )

        const securityGroup = resourceSection(
            '  StagingSecurityGroup:',
            '  StagingInstanceRole:',
        )
        expect(securityGroup).not.toContain('SecurityGroupIngress:')
        expect(securityGroup).not.toContain('Public HTTP')
        expect(securityGroup).not.toContain('Public HTTPS')
        expect(securityGroup).toContain('SecurityGroupEgress:')

        const publicRoute = resourceSection(
            '  NatGatewayDefaultRoute:',
            '  NatGatewayEip:',
        )
        expect(publicRoute).toContain('GatewayId: !Ref InternetGatewayId')
        expect(publicRoute).not.toContain('NatGatewayId:')

        const privateRoute = resourceSection(
            '  StagingDefaultRoute:',
            '  StagingSubnetRouteTableAssociation:',
        )
        expect(privateRoute).toContain('NatGatewayId: !Ref NatGateway')
        expect(privateRoute).not.toContain('\n      GatewayId:')
    })

    it('keeps the IAM instance profile within the CloudFormation schema', () => {
        const instanceProfile = resourceSection(
            '  StagingInstanceProfile:',
            '  StagingCloneReadPolicy:',
        )
        expect(instanceProfile).toContain('Roles:')
        expect(instanceProfile).not.toContain('Tags:')
    })

    it('orders the instance after both NAT routes are provisioned', () => {
        const instance = resourceSection(
            '  StagingInstance:',
            '  StagingDataVolumeAttachment:',
        )
        const dependsOnStart = instance.indexOf('    DependsOn:')
        const propertiesStart = instance.indexOf('    Properties:')

        expect(dependsOnStart).toBeGreaterThan(-1)
        expect(propertiesStart).toBeGreaterThan(dependsOnStart)

        const dependsOn = instance.slice(dependsOnStart, propertiesStart)
        expect(dependsOn).toContain('      - NatGatewayDefaultRoute')
        expect(dependsOn).toContain('      - StagingDefaultRoute')
        expect(dependsOn).toContain('      - StagingSubnetRouteTableAssociation')
    })

    it('normalizes the EBS NVMe serial before locating the dedicated data volume', () => {
        const launchTemplate = resourceSection(
            '  StagingLaunchTemplate:',
            '  StagingInstance:',
        )

        expect(launchTemplate).toContain("data_volume_id='${StagingDataVolume}'")
        expect(launchTemplate).toContain('data_volume_serial="${!data_volume_id/-/}"')
        expect(launchTemplate).toContain('[ "$serial" = "$data_volume_serial" ]')
        expect(launchTemplate).toContain('mkfs.xfs -L dpg-staging "$data_device"')
        expect(launchTemplate).not.toContain('mkfs.xfs -L dpg-isolated-staging')

        const renderedUserData = launchTemplate.replace(
            /\$\{!([^}]+)\}/g,
            (_, expression) => `\${${expression}}`,
        )
        expect(renderedUserData).toContain('data_volume_serial="${data_volume_id/-/}"')
    })

    it('exposes browser smoke only through an SSM local port-forward', () => {
        expect(isolatedRunbook).toContain('AWS-StartPortForwardingSession')
        expect(isolatedRunbook).toContain('localPortNumber')
        expect(isolatedRunbook).toContain('STAGING_BROWSER_BASE_URL=http://127.0.0.1:18000')
        expect(isolatedRunbook).toContain('npm run test:homepage')
        expect(stagingRunner).toContain("'--publish', '127.0.0.1:3000:3000'")
        expect(stagingRunner).not.toContain("'--publish', '127.0.0.1::3000'")
        expect(stagingRunner).toContain('https://dongphugia-staging.example.test')
        expect(stagingRunner).not.toContain('isolated-staging.invalid')
        expect(browserConfig).toContain('STAGING_BROWSER_BASE_URL')
        expect(browserConfig).toContain('webServer: remoteBaseUrl ? undefined')
    })
})
