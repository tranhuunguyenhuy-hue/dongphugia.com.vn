import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const template = readFileSync(
    resolve(process.cwd(), 'infra/dedicated-staging/dedicated-staging.yaml'),
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
        expect(template).toContain('DependsOn:\n      - StagingDefaultRoute')
        expect(template).not.toContain('\n  StagingElasticIp:')
        expect(template).not.toContain('\n  StagingElasticIpAssociation:')
        expect(template).not.toContain('\n  ElasticIpAddress:')
        expect(template).not.toMatch(
            /Type: AWS::EC2::EIPAssociation[\s\S]*?InstanceId: !Ref StagingInstance/,
        )

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

    it('orders the instance after the private route is provisioned', () => {
        const instance = resourceSection(
            '  StagingInstance:',
            '  StagingDataVolumeAttachment:',
        )
        expect(instance).toContain('StagingDefaultRoute')
        expect(instance).toContain('StagingSubnetRouteTableAssociation')
    })
})
