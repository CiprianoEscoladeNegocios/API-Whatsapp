import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const hasDbUrl = !!process.env.DATABASE_URL
    const hasSecret = !!process.env.NEXTAUTH_SECRET
    const secretLength = process.env.NEXTAUTH_SECRET ? process.env.NEXTAUTH_SECRET.length : 0
    
    // Diagnóstico do Pusher
    const hasPusherAppId = !!process.env.PUSHER_APP_ID
    const hasPusherKey = !!process.env.PUSHER_KEY
    const hasPusherSecret = !!process.env.PUSHER_SECRET
    const hasPusherCluster = !!process.env.PUSHER_CLUSTER
    const hasPublicPusherKey = !!process.env.NEXT_PUBLIC_PUSHER_KEY
    const hasPublicPusherCluster = !!process.env.NEXT_PUBLIC_PUSHER_CLUSTER

    // Testar conexão real de banco
    let dbConnectionSuccess = false
    let userCount = 0
    let dbError = null

    try {
      userCount = await prisma.user.count()
      dbConnectionSuccess = true
    } catch (err: any) {
      dbError = err.message || err
    }

    return NextResponse.json({
      environment: {
        DATABASE_URL_DEFINED: hasDbUrl,
        NEXTAUTH_SECRET_DEFINED: hasSecret,
        NEXTAUTH_SECRET_LENGTH: secretLength,
        NODE_ENV: process.env.NODE_ENV,
        PUSHER: {
          SERVER_APP_ID_DEFINED: hasPusherAppId,
          SERVER_KEY_DEFINED: hasPusherKey,
          SERVER_SECRET_DEFINED: hasPusherSecret,
          SERVER_CLUSTER_DEFINED: hasPusherCluster,
          CLIENT_KEY_DEFINED: hasPublicPusherKey,
          CLIENT_CLUSTER_DEFINED: hasPublicPusherCluster
        }
      },
      database: {
        CONNECTION_SUCCESS: dbConnectionSuccess,
        USER_COUNT: userCount,
        ERROR: dbError
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
