/**
 * Script de Diagnóstico e Validação de Infraestrutura do Cipriano Conversas
 * 
 * Este script valida as credenciais do .env conectando-se ao Supabase PostgreSQL,
 * à API do Twilio e à API da Meta, emitindo um relatório completo.
 * Desenvolvido sob as diretrizes de excelência em engenharia da Cipriano Escola de Negócios.
 */

import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

// 1. CARREGAR VARIÁVEIS DE AMBIENTE PROGRAMATICAMENTE DO .ENV
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) {
    console.error('❌ Erro: Arquivo .env não encontrado na raiz do projeto.')
    process.exit(1)
  }

  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    
    // Divide no primeiro '='
    const index = trimmed.indexOf('=')
    if (index === -1) return
    
    const key = trimmed.substring(0, index).trim()
    let val = trimmed.substring(index + 1).trim()
    
    // Remove aspas se houver
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1)
    }
    
    // Apenas preenche se não estiver definido
    if (!process.env[key]) {
      process.env[key] = val
    }
  })
  console.log('📝 Variáveis de ambiente carregadas do .env com sucesso!')
}

loadEnv()

// Inicializa o Prisma
const prisma = new PrismaClient()

async function testDatabase() {
  console.log('\n--- 🔌 TESTANDO CONEXÃO COM BANCO DE DADOS (Supabase) ---')
  try {
    const start = Date.now()
    // Executa uma query simples e leve para testar a conectividade física do banco
    const result = await prisma.$queryRaw`SELECT NOW() as db_time;`
    const duration = Date.now() - start
    
    console.log('✅ Banco de dados conectado com sucesso!')
    console.log(`⏱️  Tempo de resposta: ${duration}ms`)
    console.log(`📅 Hora no servidor do banco: ${(result as any)[0].db_time}`)

    // Conta os contatos para ver se temos acesso de leitura às tabelas
    const contactsCount = await prisma.contact.count()
    console.log(`👥 Contatos cadastrados no banco: ${contactsCount}`)
    
    return { success: true, count: contactsCount }
  } catch (error: any) {
    console.error('❌ ERRO AO CONECTAR COM O BANCO DE DADOS:')
    console.error(`🔴 Detalhes: ${error.message}`)
    return { success: false, error: error.message }
  }
}

async function testTwilio() {
  console.log('\n--- 📞 TESTANDO CONEXÃO COM A API DO TWILIO ---')
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid || accountSid === 'seu_account_sid_aqui' || !authToken || authToken === 'seu_auth_token_aqui') {
    console.log('⚠️  Credenciais do Twilio não configuradas ou usando valores padrões.')
    console.log('ℹ️   O sistema funcionará em MOCK MODE para o Twilio.')
    return { success: false, mode: 'mock' }
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const start = Date.now()
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    })
    const duration = Date.now() - start

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Credenciais do Twilio Inválidas!')
      console.error(`🔴 Código do Erro: ${data.code || response.status}`)
      console.error(`🔴 Mensagem do Twilio: ${data.message || 'Não autorizada'}`)
      return { success: false, error: data.message }
    }

    console.log('✅ Conexão com Twilio validada e credenciais aceitas!')
    console.log(`⏱️  Tempo de resposta da API do Twilio: ${duration}ms`)
    console.log(`👤 Nome da Conta no Twilio: "${data.friendly_name}"`)
    console.log(`📈 Status da Conta: ${data.status}`)
    console.log(`📱 Número de Origem WhatsApp configurado: ${fromNumber}`)
    return { success: true, accountName: data.friendly_name }
  } catch (error: any) {
    console.error('❌ Erro de rede ou de transporte ao contatar o Twilio:')
    console.error(`🔴 Detalhes: ${error.message}`)
    return { success: false, error: error.message }
  }
}

async function testMeta() {
  console.log('\n--- 🔗 TESTANDO CONEXÃO COM A API DA META ---')
  const accessToken = process.env.META_WA_ACCESS_TOKEN
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID

  if (!accessToken || accessToken.startsWith('EAA') && accessToken.endsWith('...') || !phoneNumberId || phoneNumberId === '1234567890') {
    console.log('⚠️  Credenciais do WhatsApp Cloud da Meta não configuradas ou usando valores padrões.')
    console.log('ℹ️   O sistema funcionará em MOCK MODE para a Meta.')
    return { success: false, mode: 'mock' }
  }

  try {
    // Tenta obter informações do ID do número de telefone configurado
    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}`
    const start = Date.now()
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    const duration = Date.now() - start

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Credenciais do WhatsApp Cloud da Meta Inválidas!')
      console.error(`🔴 Detalhes do Erro da Meta:`, data.error?.message || data)
      return { success: false, error: data.error?.message }
    }

    console.log('✅ Conexão com API do WhatsApp da Meta validada com sucesso!')
    console.log(`⏱️  Tempo de resposta da API da Meta: ${duration}ms`)
    console.log(`📱 ID do Número: ${data.id}`)
    console.log(`🏢 ID da Conta Business da Meta: ${data.whatsapp_business_api_data?.whatsapp_business_account_id || 'Não disponível'}`)
    return { success: true }
  } catch (error: any) {
    console.error('❌ Erro de rede ou de transporte ao contatar a API da Meta:')
    console.error(`🔴 Detalhes: ${error.message}`)
    return { success: false, error: error.message }
  }
}

async function run() {
  console.log('==================================================================')
  console.log('🎓 CIPRIANO ESCOLA DE NEGÓCIOS - VALIDADOR DE INFRAESTRUTURA 🎓')
  console.log('==================================================================')
  
  const dbRes = await testDatabase()
  const twilioRes = await testTwilio()
  const metaRes = await testMeta()
  
  console.log('\n==================================================================')
  console.log('📊 PAINEL EXECUTIVO DE RESUMO:')
  console.log('==================================================================')
  console.log(`💾 Banco Supabase:   ${dbRes.success ? '🟢 ATIVO (Pronto para Produção)' : '🔴 FALHA NA CONEXÃO'}`)
  console.log(`📞 Provedor Twilio:   ${twilioRes.success ? '🟢 ATIVO (Conectado)' : (twilioRes.mode === 'mock' ? '🟡 MOCK MODE (Simulação)' : '🔴 ERRO DE CREDENCIAIS')}`)
  console.log(`🔗 Provedor Meta:     ${metaRes.success ? '🟢 ATIVO (Conectado)' : (metaRes.mode === 'mock' ? '🟡 MOCK MODE (Simulação)' : '🔴 ERRO DE CREDENCIAIS')}`)
  console.log('==================================================================')
  
  if (dbRes.success && (twilioRes.success || twilioRes.mode === 'mock') && (metaRes.success || metaRes.mode === 'mock')) {
    console.log('\n🏆 PARABÉNS! A infraestrutura está pronta para voar alto. 🏆')
    console.log('Cipriano Escola de Negócios: Formando líderes, construindo o futuro.')
  } else {
    console.log('\n⚠️ Algumas pendências precisam de atenção antes de iniciarmos os testes.')
  }
  
  // Desconecta o Prisma
  await prisma.$disconnect()
}

run()
