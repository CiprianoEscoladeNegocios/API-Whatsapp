import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// 1. LISTAGEM DE OPERADORES (Apenas ADMIN)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso restrito. Apenas administradores podem gerenciar operadores.' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(users)
  } catch (err) {
    console.error('Erro ao listar operadores:', err)
    return NextResponse.json({ error: 'Erro interno ao listar operadores.' }, { status: 500 })
  }
}

// 2. CRIAÇÃO DE OPERADORES (Apenas ADMIN)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso restrito. Apenas administradores podem gerenciar operadores.' }, { status: 403 })
    }

    const body = await req.json()
    const { name, email, password, role } = body

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Por favor, preencha todos os campos obrigatórios.' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Este e-mail já está sendo utilizado por outro operador.' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role as 'ADMIN' | 'OPERATOR'
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    })

    return NextResponse.json(newUser, { status: 201 })
  } catch (err) {
    console.error('Erro ao cadastrar operador:', err)
    return NextResponse.json({ error: 'Erro interno ao cadastrar operador.' }, { status: 500 })
  }
}

// 3. ATUALIZAÇÃO DE OPERADORES (Apenas ADMIN)
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso restrito. Apenas administradores podem gerenciar operadores.' }, { status: 403 })
    }

    const body = await req.json()
    const { id, name, email, password, role } = body

    if (!id || !name || !email || !role) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'Operador não encontrado.' }, { status: 404 })
    }

    // Verifica se o novo e-mail conflita com outro usuário
    if (email !== existingUser.email) {
      const emailConflict = await prisma.user.findUnique({
        where: { email }
      })
      if (emailConflict) {
        return NextResponse.json({ error: 'Este e-mail já está sendo utilizado por outro operador.' }, { status: 400 })
      }
    }

    const updateData: any = {
      name,
      email,
      role: role as 'ADMIN' | 'OPERATOR'
    }

    // Só atualiza a senha se ela foi fornecida no formulário
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10)
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    })

    return NextResponse.json(updatedUser)
  } catch (err) {
    console.error('Erro ao atualizar operador:', err)
    return NextResponse.json({ error: 'Erro interno ao atualizar operador.' }, { status: 500 })
  }
}

// 4. EXCLUSÃO DE OPERADORES (Apenas ADMIN)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso restrito. Apenas administradores podem gerenciar operadores.' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Identificador do operador não informado.' }, { status: 400 })
    }

    // Bloqueia autodeleção
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Não é possível excluir a sua própria conta ativa.' }, { status: 400 })
    }

    await prisma.user.delete({
      where: { id }
    })

    return NextResponse.json({ success: true, message: 'Operador removido com sucesso.' })
  } catch (err) {
    console.error('Erro ao remover operador:', err)
    return NextResponse.json({ error: 'Erro interno ao remover operador.' }, { status: 500 })
  }
}
