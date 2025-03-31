const { expect } = require("chai");
const hre = require("hardhat");

describe("IndustryKnowledgeFolder", function () {
  let knowledgeToken;
  let knowledgeFolder;
  let owner;
  let admin;
  let user1;
  let user2;
  let addrs;

  beforeEach(async function () {
    // 使用 hre.ethers 而不是 ethers
    const ethers = hre.ethers;
    
    // 获取签名者
    [owner, admin, user1, user2, ...addrs] = await hre.ethers.getSigners();
    
    // 获取合约工厂
    const KnowledgeToken = await hre.ethers.getContractFactory("KnowledgeToken");
    const IndustryKnowledgeFolder = await hre.ethers.getContractFactory("IndustryKnowledgeFolder");
    
    // 部署合约
    knowledgeToken = await KnowledgeToken.deploy(1000000);
    await knowledgeToken.waitForDeployment();
    
    const tokenAddress = await knowledgeToken.getAddress();
    knowledgeFolder = await IndustryKnowledgeFolder.deploy(tokenAddress);
    await knowledgeFolder.waitForDeployment();
    
    // 设置知识库合约为代币铸造者
    await knowledgeToken.addMinter(await knowledgeFolder.getAddress());
  });

  describe("部署", function () {
    it("应该正确设置管理员", async function () {
      expect(await knowledgeFolder.admin()).to.equal(await owner.getAddress());
    });

    it("应该正确设置代币合约", async function () {
      expect(await knowledgeFolder.tokenContract()).to.equal(await knowledgeToken.getAddress());
    });
  });

  describe("文件上传", function () {
    it("应该允许用户上传文件", async function () {
      const filename = "test.txt";
      // 使用 hre.ethers 而不是 ethers
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test content"));
      const size = 100;
      const category = "测试";
      const metadata = '{"description": "测试文件"}';
      
      await expect(
        knowledgeFolder.connect(user1).uploadFile(filename, hash, size, category, metadata)
      )
        .to.emit(knowledgeFolder, "FileUploaded")
        .withArgs(filename, await user1.getAddress(), category);
      
      const fileCount = await knowledgeFolder.getFileCount();
      expect(fileCount).to.equal(1n);  // 注意：ethers v6 返回 BigInt
      
      const [fileHash, fileSize, fileOwner, , fileStatus, fileCategory, fileMetadata] = 
        await knowledgeFolder.getFileDetails(filename);
      
      expect(fileHash).to.equal(hash);
      expect(fileSize).to.equal(size);
      expect(fileOwner).to.equal(await user1.getAddress());
      expect(fileStatus).to.equal(0);
      expect(fileCategory).to.equal(category);
      expect(fileMetadata).to.equal(metadata);
    });

    it("不应该允许上传同名文件", async function () {
      const filename = "test.txt";
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test content"));
      const size = 100;
      const category = "测试";
      const metadata = '{"description": "测试文件"}';
      
      await knowledgeFolder.connect(user1).uploadFile(filename, hash, size, category, metadata);
      
      await expect(
        knowledgeFolder.connect(user2).uploadFile(filename, hash, size, category, metadata)
      ).to.be.revertedWith("文件已存在");
    });

    it("不应该允许上传文件大小为0的文件", async function () {
      const filename = "test.txt";
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test content"));
      const size = 0;
      const category = "测试";
      const metadata = '{"description": "测试文件"}';
      
      await expect(
        knowledgeFolder.connect(user1).uploadFile(filename, hash, size, category, metadata)
      ).to.be.revertedWith("文件大小必须为正数");
    });

    it("不应该允许上传空类别的文件", async function () {
      const filename = "test.txt";
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test content"));
      const size = 100;
      const category = "";
      const metadata = '{"description": "测试文件"}';
      
      await expect(
        knowledgeFolder.connect(user1).uploadFile(filename, hash, size, category, metadata)
      ).to.be.revertedWith("类别不能为空");
    });
  });

  describe("文件审核", function () {
    beforeEach(async function () {
      const filename = "test.txt";
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test content"));
      const size = 100;
      const category = "测试";
      const metadata = '{"description": "测试文件"}';
      
      await knowledgeFolder.connect(user1).uploadFile(filename, hash, size, category, metadata);
    });

    it("应该允许管理员批准文件并奖励代币", async function () {
      const filename = "test.txt";
      const rewardAmount = hre.ethers.parseEther("10");
      
      await expect(knowledgeFolder.approveFile(filename, rewardAmount))
        .to.emit(knowledgeFolder, "FileApproved")
        .withArgs(filename, rewardAmount);
      
      const [, , , , fileStatus, , ] = await knowledgeFolder.getFileDetails(filename);
      expect(fileStatus).to.equal(1); // 已审核
      
      const balance = await knowledgeToken.balanceOf(await user1.getAddress());
      expect(balance).to.equal(rewardAmount);
      
      const totalApproved = await knowledgeFolder.totalApprovedFiles();
      expect(totalApproved).to.equal(1n);
      
      const totalRewarded = await knowledgeFolder.totalTokensRewarded();
      expect(totalRewarded).to.equal(rewardAmount);
    });

    it("应该允许管理员拒绝文件", async function () {
      const filename = "test.txt";
      const reason = "格式不符合要求";
      
      await expect(knowledgeFolder.rejectFile(filename, reason))
        .to.emit(knowledgeFolder, "FileRejected")
        .withArgs(filename, reason);
      
      const [, , , , fileStatus, , ] = await knowledgeFolder.getFileDetails(filename);
      expect(fileStatus).to.equal(2); // 已拒绝
      
      const totalRejected = await knowledgeFolder.totalRejectedFiles();
      expect(totalRejected).to.equal(1n);
    });

    it("不应该允许非管理员批准文件", async function () {
      const filename = "test.txt";
      const rewardAmount = hre.ethers.parseEther("10");
      
      await expect(
        knowledgeFolder.connect(user2).approveFile(filename, rewardAmount)
      ).to.be.revertedWith("只有管理员可以执行此操作");
    });

    it("不应该允许非管理员拒绝文件", async function () {
      const filename = "test.txt";
      const reason = "格式不符合要求";
      
      await expect(
        knowledgeFolder.connect(user2).rejectFile(filename, reason)
      ).to.be.revertedWith("只有管理员可以执行此操作");
    });

    it("不应该允许批准已审核的文件", async function () {
      const filename = "test.txt";
      const rewardAmount = hre.ethers.parseEther("10");
      
      await knowledgeFolder.approveFile(filename, rewardAmount);
      
      await expect(
        knowledgeFolder.approveFile(filename, rewardAmount)
      ).to.be.revertedWith("文件不处于待审核状态");
    });

    it("不应该允许拒绝已审核的文件", async function () {
      const filename = "test.txt";
      const rewardAmount = hre.ethers.parseEther("10");
      const reason = "格式不符合要求";
      
      await knowledgeFolder.approveFile(filename, rewardAmount);
      
      await expect(
        knowledgeFolder.rejectFile(filename, reason)
      ).to.be.revertedWith("文件不处于待审核状态");
    });
  });

  describe("文件更新", function () {
    beforeEach(async function () {
      const filename = "test.txt";
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test content"));
      const size = 100;
      const category = "测试";
      const metadata = '{"description": "测试文件"}';
      
      await knowledgeFolder.connect(user1).uploadFile(filename, hash, size, category, metadata);
    });

    it("应该允许文件所有者更新未审核的文件", async function () {
      const filename = "test.txt";
      const newHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("updated content"));
      const newSize = 200;
      const newMetadata = '{"description": "更新后的测试文件"}';
      
      await expect(
        knowledgeFolder.connect(user1).updateFile(filename, newHash, newSize, newMetadata)
      )
        .to.emit(knowledgeFolder, "FileUpdated")
        .withArgs(filename, newHash, newSize);
      
      const [fileHash, fileSize, , , , , fileMetadata] = await knowledgeFolder.getFileDetails(filename);
      expect(fileHash).to.equal(newHash);
      expect(fileSize).to.equal(newSize);
      expect(fileMetadata).to.equal(newMetadata);
    });

    it("应该允许文件所有者更新被拒绝的文件并重新设为待审核", async function () {
      const filename = "test.txt";
      const reason = "格式不符合要求";
      
      await knowledgeFolder.rejectFile(filename, reason);
      
      const newHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("updated content"));
      const newSize = 200;
      const newMetadata = '{"description": "更新后的测试文件"}';
      
      await knowledgeFolder.connect(user1).updateFile(filename, newHash, newSize, newMetadata);
      
      const [, , , , fileStatus, , ] = await knowledgeFolder.getFileDetails(filename);
      expect(fileStatus).to.equal(0); // 待审核
      
      const totalRejected = await knowledgeFolder.totalRejectedFiles();
      expect(totalRejected).to.equal(0n);
      
      const totalPending = await knowledgeFolder.totalPendingFiles();
      expect(totalPending).to.equal(1n);
    });

    it("不应该允许非所有者更新文件", async function () {
      const filename = "test.txt";
      const newHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("updated content"));
      const newSize = 200;
      const newMetadata = '{"description": "更新后的测试文件"}';
      
      await expect(
        knowledgeFolder.connect(user2).updateFile(filename, newHash, newSize, newMetadata)
      ).to.be.revertedWith("只有文件所有者可以执行此操作");
    });

    it("不应该允许更新已审核的文件", async function () {
      const filename = "test.txt";
      const rewardAmount = hre.ethers.parseEther("10");
      
      await knowledgeFolder.approveFile(filename, rewardAmount);
      
      const newHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("updated content"));
      const newSize = 200;
      const newMetadata = '{"description": "更新后的测试文件"}';
      
      await expect(
        knowledgeFolder.connect(user1).updateFile(filename, newHash, newSize, newMetadata)
      ).to.be.revertedWith("已审核的文件不能更新");
    });
  });

  describe("查询功能", function () {
    beforeEach(async function () {
      // 上传多个文件
      const categories = ["文档", "图片", "音频"];
      const users = [user1, user2];
      
      for (let i = 0; i < categories.length; i++) {
        for (let j = 0; j < users.length; j++) {
          const filename = `file${i}_${j}.txt`;
          const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`content ${i} ${j}`));
          const size = 100 * (i + 1);
          const category = categories[i];
          const metadata = `{"description": "文件 ${i} ${j}"}`;
          
          await knowledgeFolder.connect(users[j]).uploadFile(filename, hash, size, category, metadata);
        }
      }
      
      // 批准和拒绝一些文件
      await knowledgeFolder.approveFile("file0_0.txt", hre.ethers.parseEther("5"));
      await knowledgeFolder.approveFile("file1_1.txt", hre.ethers.parseEther("10"));
      await knowledgeFolder.rejectFile("file2_0.txt", "格式不符合要求");
    });

    it("应该正确返回文件总数", async function () {
      const fileCount = await knowledgeFolder.getFileCount();
      expect(fileCount).to.equal(6n);
    });

    it("应该正确返回按类别查询的文件", async function () {
      const filesByCategory = await knowledgeFolder.getFilesByCategory("文档");
      expect(filesByCategory.length).to.equal(2n);
      expect(filesByCategory).to.include("file0_0.txt");
      expect(filesByCategory).to.include("file0_1.txt");
    });

    it("应该正确返回按用户查询的文件", async function () {
      const filesByUser = await knowledgeFolder.getUserFiles(await user1.getAddress());
      expect(filesByUser.length).to.equal(3n);
      expect(filesByUser).to.include("file0_0.txt");
      expect(filesByUser).to.include("file1_0.txt");
      expect(filesByUser).to.include("file2_0.txt");
    });

    it("应该正确返回按状态查询的文件", async function () {
      const pendingFiles = await knowledgeFolder.getFilesByStatus(0n);
      expect(pendingFiles.length).to.equal(3n);
      
      const approvedFiles = await knowledgeFolder.getFilesByStatus(1n);
      expect(approvedFiles.length).to.equal(2n);
      expect(approvedFiles).to.include("file0_0.txt");
      expect(approvedFiles).to.include("file1_1.txt");
      
      const rejectedFiles = await knowledgeFolder.getFilesByStatus(2n);
      expect(rejectedFiles.length).to.equal(1n);
      expect(rejectedFiles).to.include("file2_0.txt");
    });

    it("应该正确返回文件详情", async function () {
      const filename = "file0_0.txt";
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("content 0 0"));
      const size = 100;
      const category = "文档";
      const metadata = '{"description": "文件 0 0"}';
      
      const [fileHash, fileSize, fileOwner, , fileStatus, fileCategory, fileMetadata] = 
        await knowledgeFolder.getFileDetails(filename);
      
      expect(fileHash).to.equal(hash);
      expect(fileSize).to.equal(size);
      expect(fileOwner).to.equal(await user1.getAddress());
      expect(fileStatus).to.equal(1n); // 已审核
      expect(fileCategory).to.equal(category);
      expect(fileMetadata).to.equal(metadata);
    });
  });

  describe("管理员功能", function () {
    it("应该允许管理员更改管理员", async function () {
      await expect(knowledgeFolder.changeAdmin(await admin.getAddress()))
        .to.emit(knowledgeFolder, "AdminChanged")
        .withArgs(await owner.getAddress(), await admin.getAddress());
      
      expect(await knowledgeFolder.admin()).to.equal(await admin.getAddress());
    });

    it("不应该允许非管理员更改管理员", async function () {
      await expect(
        knowledgeFolder.connect(user1).changeAdmin(await user1.getAddress())
      ).to.be.revertedWith("只有管理员可以执行此操作");
    });

    it("应该允许管理员设置代币合约", async function () {
      const newTokenContract = await (await hre.ethers.getContractFactory("KnowledgeToken")).deploy(1000000);
      await newTokenContract.waitForDeployment();
      
      await knowledgeFolder.setTokenContract(await newTokenContract.getAddress());
      
      expect(await knowledgeFolder.tokenContract()).to.equal(await newTokenContract.getAddress());
    });

    it("不应该允许非管理员设置代币合约", async function () {
      const newTokenContract = await (await hre.ethers.getContractFactory("KnowledgeToken")).deploy(1000000);
      await newTokenContract.waitForDeployment();
      
      await expect(
        knowledgeFolder.connect(user1).setTokenContract(await newTokenContract.getAddress())
      ).to.be.revertedWith("只有管理员可以执行此操作");
    });

    it("不应该允许将代币合约设置为零地址", async function () {
      await expect(
        // 使用新版本的 API
        knowledgeFolder.setTokenContract(hre.ethers.ZeroAddress)
      ).to.be.revertedWith("无效地址");
    });
  });
});