import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- TESTANDO A ATUALIZAÇÃO DO CONTATO ---')
  const res = await prisma.contact.update({
    where: { id: "0510eeab-b862-4bb7-aecc-6bdd2118304d" },
    data: {
      name: "Administrativo Cipriano",
      phone: "554488282956",
      tags: { set: ["Cipriano"] }
    }
  })
  console.log("Success:", JSON.stringify(res, null, 2))
}

main()
  .catch((e) => {
    console.error("ERRO CRÍTICO NA ATUALIZAÇÃO:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
