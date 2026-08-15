import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

/**
 * 测试数据清理脚本
 * -------------------------------
 * 用途：清理开发 / 测试过程中产生的测试数据，保留真实业务数据。
 *
 * 识别规则（测试数据必须带有明显标识）：
 * - 用户 username 前缀：test_ / e2e_ / live_ / webflow_ / web_ / p15 / prod_ / p151
 * - 商品条码前缀：999999（按规范）、69 开头且名称为测试名称的商品；以及常见测试商品名
 * - 由上述测试用户创建/参与的房间、饮酒记录、操作日志
 *
 * 不会删除：
 * - seed 用户（admin / testuser）
 * - 真实用户及其关联数据
 *
 * 使用：
 *   pnpm cleanup:test-data
 */
loadEnv({ path: "apps/api/.env" });

const prisma = new PrismaClient();

const USERNAME_PREFIXES = [
  "test_",
  "e2e_",
  "live_",
  "webflow_",
  "web_",
  "p15",
  "p151",
  "prod_",
];

/** 种子账号 / 真实业务账号：永远不能删除 */
const PROTECTED_USERNAMES = ["admin", "testuser"];

async function main(): Promise<void> {
  // 1. 找出测试用户（排除种子账号与真实账号）
  const testUsers = await prisma.user.findMany({
    where: {
      AND: [
        {
          OR: USERNAME_PREFIXES.map((prefix) => ({
            username: { startsWith: prefix },
          })),
        },
        { username: { notIn: PROTECTED_USERNAMES } },
      ],
    },
    select: { id: true, username: true },
  });
  const testUserIds = testUsers.map((u) => u.id);
  console.log(
    `找到测试用户 ${testUserIds.length} 个：${testUsers.map((u) => u.username).join(", ")}`,
  );

  if (testUserIds.length === 0) {
    console.log("没有测试用户，跳过用户相关清理。");
  } else {
    // 2. 删除这些用户作为饮用者/登记人/删除执行人的饮酒记录
    const drinkAsUser = await prisma.drinkRecord.deleteMany({
      where: {
        OR: [
          { userId: { in: testUserIds } },
          { createdBy: { in: testUserIds } },
          { deletedBy: { in: testUserIds } },
        ],
      },
    });
    console.log(`删除饮酒记录（用户相关）：${drinkAsUser.count} 条`);

    // 3. 删除测试用户拥有的房间的饮酒记录、成员、房间
    const ownedRooms = await prisma.room.findMany({
      where: { ownerId: { in: testUserIds } },
      select: { id: true },
    });
    const ownedRoomIds = ownedRooms.map((r) => r.id);
    if (ownedRoomIds.length > 0) {
      const roomDrinks = await prisma.drinkRecord.deleteMany({
        where: { roomId: { in: ownedRoomIds } },
      });
      const roomMembers = await prisma.roomMember.deleteMany({
        where: { roomId: { in: ownedRoomIds } },
      });
      const rooms = await prisma.room.deleteMany({
        where: { id: { in: ownedRoomIds } },
      });
      console.log(
        `清理测试房间 ${rooms.count} 个（饮酒记录 ${roomDrinks.count} 条、成员 ${roomMembers.count} 条）`,
      );
    }

    // 4. 删除测试用户的其他成员关系
    const memberOther = await prisma.roomMember.deleteMany({
      where: { userId: { in: testUserIds } },
    });
    console.log(`删除测试用户的其他成员关系：${memberOther.count} 条`);

    // 5. 删除测试用户的操作日志（作为 admin）
    const adminLogs = await prisma.operationLog.deleteMany({
      where: { adminUserId: { in: testUserIds } },
    });
    console.log(`删除测试用户操作日志：${adminLogs.count} 条`);

    // 6. 删除测试用户
    const users = await prisma.user.deleteMany({
      where: { id: { in: testUserIds } },
    });
    console.log(`删除测试用户：${users.count} 个`);
  }

  // 7. 清理测试商品
  const testProducts = await prisma.product.findMany({
    where: {
      OR: [
        { barcode: { startsWith: "999999" } },
        { name: { contains: "测试" } },
        { name: { contains: "实测" } },
        { name: { contains: "后台" } },
        { name: { contains: "批量" } },
        { name: { contains: "日志" } },
        { name: { contains: "P15" } },
        { name: { in: ["手动测试啤酒"] } },
      ],
    },
    select: { id: true, name: true },
  });
  const testProductIds = testProducts.map((p) => p.id);
  if (testProductIds.length > 0) {
    // 先删除仍引用这些商品的饮酒记录
    const orphanDrinks = await prisma.drinkRecord.deleteMany({
      where: { productId: { in: testProductIds } },
    });
    console.log(`删除引用测试商品的饮酒记录：${orphanDrinks.count} 条`);
    const products = await prisma.product.deleteMany({
      where: { id: { in: testProductIds } },
    });
    console.log(
      `删除测试商品 ${products.count} 个：${testProducts.map((p) => p.name).join(", ")}`,
    );
  } else {
    console.log("没有测试商品可清理。");
  }

  console.log("测试数据清理完成。");
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("清理失败：", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
