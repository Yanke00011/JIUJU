import { hash } from '@node-rs/argon2';
import { PrismaClient, ProductCategory, UserRole } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

// 加载 API 工作区的环境变量（SEED_ADMIN_PASSWORD 等）
loadEnv({ path: 'apps/api/.env' });

const prisma = new PrismaClient();

const ADMIN_USERNAME = 'admin';
const TEST_USERNAME = 'testuser';
const TEST_PASSWORD = 'testuser-dev-password-2026';

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const TEST_PRODUCTS = [
  {
    barcode: '6901234567890',
    name: '示例浓香型白酒 500ml',
    brand: '示例品牌',
    category: ProductCategory.BAIJIU,
    volumeMl: 500,
    alcoholPercent: '52.00',
  },
  {
    barcode: '6901234567891',
    name: '示例精酿啤酒 500ml',
    brand: '示例品牌',
    category: ProductCategory.BEER,
    volumeMl: 500,
    alcoholPercent: '4.50',
  },
  {
    barcode: '6901234567892',
    name: '示例干红葡萄酒 750ml',
    brand: '示例品牌',
    category: ProductCategory.RED_WINE,
    volumeMl: 750,
    alcoholPercent: '13.50',
  },
];

async function main(): Promise<void> {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword === 'change-me-before-use') {
    throw new Error(
      'SEED_ADMIN_PASSWORD 未设置或仍为占位值。请在 apps/api/.env 中配置后再运行 seed。',
    );
  }

  // SUPER_ADMIN（密码来自环境变量）
  await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {
      passwordHash: await hash(adminPassword, ARGON2_OPTIONS),
      role: UserRole.SUPER_ADMIN,
      status: 'ACTIVE',
    },
    create: {
      username: ADMIN_USERNAME,
      passwordHash: await hash(adminPassword, ARGON2_OPTIONS),
      nickname: '超级管理员',
      role: UserRole.SUPER_ADMIN,
      status: 'ACTIVE',
    },
  });

  // 测试用户（开发环境占位密码，非生产凭据）
  await prisma.user.upsert({
    where: { username: TEST_USERNAME },
    update: {
      passwordHash: await hash(TEST_PASSWORD, ARGON2_OPTIONS),
      nickname: '测试用户',
      role: UserRole.USER,
      status: 'ACTIVE',
    },
    create: {
      username: TEST_USERNAME,
      passwordHash: await hash(TEST_PASSWORD, ARGON2_OPTIONS),
      nickname: '测试用户',
      role: UserRole.USER,
      status: 'ACTIVE',
    },
  });

  // 测试酒品
  for (const product of TEST_PRODUCTS) {
    await prisma.product.upsert({
      where: { barcode: product.barcode },
      update: {
        name: product.name,
        brand: product.brand,
        category: product.category,
        volumeMl: product.volumeMl,
        alcoholPercent: product.alcoholPercent,
      },
      create: product,
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seed 完成：SUPER_ADMIN=${ADMIN_USERNAME}，测试用户=${TEST_USERNAME}，测试酒品=${TEST_PRODUCTS.length} 个。`,
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed 失败：', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
