import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export function normalizeName(rawName, productType = '') {
  let name = rawName.replace(/\s+/g, ' ').trim()

  if (name.toLowerCase().includes('bồn cầu') || productType === 'bon-cau') {
    let bodyType = ''
    if (name.match(/1 khối|một khối/i)) bodyType = '1 khối'
    else if (name.match(/2 khối|hai khối/i)) bodyType = '2 khối'
    else if (name.match(/đặt sàn/i)) bodyType = 'đặt sàn'
    else if (name.match(/treo tường/i)) bodyType = 'treo tường'
    else if (name.match(/thông minh|neorest/i)) bodyType = 'thông minh Neorest'

    let mainModel = ''
    const modelMatch = name.match(/\b(MS\w+|CS\w+|CW\w+|C\w+)\b/)
    if (modelMatch) mainModel = modelMatch[1]

    let coverType = ''
    if (name.match(/đóng êm/i)) coverType = 'nắp đóng êm'
    else if (name.match(/rửa cơ|ecowasher/i)) coverType = 'nắp rửa cơ Ecowasher'
    else if (name.match(/điện tử|washlet/i)) {
      coverType = 'nắp rửa điện tử Washlet'
      const versionMatch = name.match(/washlet\s+(C\d|S\d[A-Z]?|G\d[A-Z]?)/i)
      if (versionMatch) coverType += ' ' + versionMatch[1].toUpperCase()
      else {
        const standaloneVersion = name.match(/\b(C2|C5|S7|S7A|G5A)\b/i)
        if (standaloneVersion) coverType += ' ' + standaloneVersion[1].toUpperCase()
      }
    }

    let coverModel = ''
    const coverMatch = name.match(/\b(TCF\w+|TCW\w+|TC\w+)\b/)
    if (coverMatch) coverModel = coverMatch[1]

    let specialFeatures = []
    if (name.match(/giấu dây/i)) specialFeatures.push('giấu dây')
    if (name.match(/kèm van xả/i)) specialFeatures.push('kèm van xả')

    let components = []
    // Updated regex to include TCA and allow hyphens
    const compRegex = /\b(T53[A-Z0-9\-]+|WH[A-Z0-9\-]+|MB[A-Z0-9\-]+|TCA[A-Z0-9\-]+|TX[A-Z0-9\-]+)\b/gi
    let compMatch
    while ((compMatch = compRegex.exec(name)) !== null) {
      let code = compMatch[1].toUpperCase()
      if (code !== mainModel && code !== coverModel) {
        components.push(code)
      }
    }
    components = [...new Set(components)]

    if (mainModel) {
      let finalName = ('Bồn cầu ' + bodyType + ' TOTO ' + mainModel).replace(/\s+/g, ' ').trim()
      
      if (bodyType !== 'thông minh Neorest' && (coverType || coverModel)) {
        finalName += ' kèm ' + (coverType + ' ' + coverModel).replace(/\s+/g, ' ').trim()
      }

      if (specialFeatures.length > 0) {
        finalName += ' ' + specialFeatures.join(' ')
      }

      if (components.length > 0) {
        finalName += ' (' + components.join(', ') + ')'
      }

      return finalName.trim()
    }
  }

  if (name.toLowerCase().includes('chậu rửa') || name.toLowerCase().includes('lavabo')) {
    let type = ''
    if (name.match(/đặt bàn/i)) type = 'đặt bàn'
    else if (name.match(/âm bàn/i)) type = 'âm bàn'
    else if (name.match(/bán âm/i)) type = 'bán âm bàn'
    else if (name.match(/treo tường/i)) type = 'treo tường'
    else if (name.match(/dương vành/i)) type = 'dương vành'

    let modelMatch = name.match(/\b(LT\w+|LHT\w+|LW\w+|L\w+)\b/)
    if (modelMatch) {
      let finalName = ('Chậu rửa lavabo ' + type + ' TOTO ' + modelMatch[1]).replace(/\s+/g, ' ').trim()
      
      let components = []
      const compRegex = /\b(L\d{3}\w*|P\w+)\b/g
      let compMatch
      while ((compMatch = compRegex.exec(name)) !== null) {
        if (compMatch[1] !== modelMatch[1]) components.push(compMatch[1])
      }
      if (components.length > 0) finalName += ' (Kèm ' + components.join(', ') + ')'
      
      return finalName
    }
  }

  if (name.toLowerCase().includes('vòi chậu') || name.toLowerCase().includes('vòi lavabo')) {
    let modeMatch = name.match(/nóng lạnh|nhiệt độ|cảm ứng/i)
    let mode = modeMatch ? modeMatch[0].toLowerCase() : ''
    let modelMatch = name.match(/\b(TLG\w+|TLS\w+|TX\w+|TVLM\w+|TEN\w+)\b/)
    if (modelMatch) {
      return ('Vòi chậu lavabo ' + mode + ' TOTO ' + modelMatch[1]).replace(/\s+/g, ' ').trim()
    }
  }

  return name
}

async function runTest() {
  const testCases = [
    "Bồn cầu TOTO MS887CRW15 1 khối nắp điện tử Washlet C5 TCF24460AAA giấu dây",
    "Bồn cầu 1 khối TOTO MS188VKT8 T53P100VR nắp đóng êm TC600VS",
    "Bồn cầu TOTO CS749K nắp đóng êm",
    "Bồn cầu thông minh TOTO CS989VT nắp rửa điện tử Washlet",
    "Bồn cầu 2 khối TOTO CS769DRT8 (CS769DT8) nắp đóng êm TC600VS",
    "Bồn cầu treo tường TOTO CW553 kèm nắp rửa điện tử Washlet C5 WH172AT",
    "Chậu rửa mặt âm bàn TOTO LT546",
    "Chậu rửa lavabo bán âm TOTO LT533R chân chậu L533",
    "Vòi chậu lavabo nóng lạnh TOTO TLG04301V",
  ]

  console.log('=== KẾT QUẢ TEST NORMALIZE NAMING TOTO ===\n')
  for (const tc of testCases) {
    const norm = normalizeName(tc)
    console.log('❌ Tên cũ: ' + tc)
    console.log('✅ Tên mới: ' + norm + '\n')
  }
}

// Run test if executed directly
if (process.argv[1] && process.argv[1].endsWith('normalize-toto-names.mjs')) {
  runTest()
}
