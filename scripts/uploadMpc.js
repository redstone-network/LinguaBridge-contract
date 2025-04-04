const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // 获取部署的合约实例
  const [deployer] = await hre.ethers.getSigners();
  console.log("使用账户:", deployer.address);

  // 获取IndustryKnowledgeFolder合约实例
  // 注意：这里需要替换为实际部署的合约地址
  const folderAddress = process.env.FOLDER_ADDRESS;
  if (!folderAddress) {
    console.error("请在.env文件中设置FOLDER_ADDRESS环境变量");
    return;
  }

  const IndustryKnowledgeFolder = await hre.ethers.getContractFactory("IndustryKnowledgeFolder");
  const knowledgeFolder = await IndustryKnowledgeFolder.attach(folderAddress);

  // 文件路径和文件名
  const filePath = path.join(__dirname, "mpc.txt");
  const fileName = "scripts/mpc.txt";

  // 读取文件内容
  const fileContent = fs.readFileSync(filePath, "utf8");
  
  // 计算文件哈希和大小
  const fileHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(fileContent));
  const fileSize = Buffer.from(fileContent).length;
  
  // 设置文件类别和元数据
  const category = "协议文档";
  const metadata = JSON.stringify({
    description: "模型上下文协议(MCP)文档",
    format: "txt",
    lastUpdated: new Date().toISOString()
  });

  try {
    // 检查文件是否存在
    let fileExists = false;
    try {
      // 尝试获取文件详情，如果文件不存在会抛出异常
      await knowledgeFolder.getFileDetails(fileName);
      fileExists = true;
    } catch (error) {
      // 文件不存在，继续执行上传流程
      fileExists = false;
    }

    if (!fileExists) {
      // 文件不存在，上传文件
      console.log(`上传文件: ${fileName}`);
      const uploadTx = await knowledgeFolder.uploadFile(fileName, fileHash, fileSize, category, metadata);
      await uploadTx.wait();
      console.log(`文件上传成功，交易哈希: ${uploadTx.hash}`);

      // 批准文件（需要管理员权限）
      const rewardAmount = hre.ethers.parseUnits("10", 18); // 10个代币作为奖励
      const approveTx = await knowledgeFolder.approveFile(fileName, rewardAmount);
      await approveTx.wait();
      console.log(`文件批准成功，交易哈希: ${approveTx.hash}`);
    } else {
      // 文件已存在，更新文件
      console.log(`更新文件: ${fileName}`);
      const updateTx = await knowledgeFolder.updateFile(fileName, fileHash, fileSize, metadata);
      await updateTx.wait();
      console.log(`文件更新成功，交易哈希: ${updateTx.hash}`);
    }
  } catch (error) {
    console.error("操作失败:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });