import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- BUSCANDO TODOS OS CONTATOS ---')
  const contacts = await prisma.contact.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  })
  console.log(JSON.stringify(contacts, null, 2))

  console.log('--- BUSCANDO ÚLTIMAS 10 MENSAGENS ---')
  const messages = await prisma.message.findMany({
    orderBy: { timestamp: 'desc' },
    take: 10,
    include: {
      contact: true
    }
  })
  console.log(JSON.stringify(messages, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
