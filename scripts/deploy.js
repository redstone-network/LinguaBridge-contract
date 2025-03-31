const hre = require("hardhat");

async function main() {
  // 部署知识库代币合约
  const initialSupply = 1000000; // 初始供应量
  const KnowledgeToken = await hre.ethers.getContractFactory("KnowledgeToken");
  const knowledgeToken = await KnowledgeToken.deploy(initialSupply);
  await knowledgeToken.deployed();
  console.log("知识库代币部署至:", knowledgeToken.address);

  // 部署知识库文件夹合约
  const IndustryKnowledgeFolder = await hre.ethers.getContractFactory("IndustryKnowledgeFolder");
  const knowledgeFolder = await IndustryKnowledgeFolder.deploy(knowledgeToken.address);
  await knowledgeFolder.deployed();
  console.log("知识库文件夹部署至:", knowledgeFolder.address);

  // 将知识库文件夹合约设置为代币铸造者
  const addMinterTx = await knowledgeToken.addMinter(knowledgeFolder.address);
  await addMinterTx.wait();
  console.log("已将知识库文件夹设置为代币铸造者");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 