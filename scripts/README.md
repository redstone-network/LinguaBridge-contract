# 脚本使用说明

## MPC文件上传脚本 (uploadMpc.js)

这个脚本用于将`scripts/mpc.txt`文件上传到区块链上的`IndustryKnowledgeFolder`合约。脚本会自动检查文件是否已存在：
- 如果文件不存在，则调用`uploadFile`函数上传文件，并随后调用`approveFile`函数批准文件
- 如果文件已存在，则调用`updateFile`函数更新文件

### 前置条件

1. 确保已经部署了`IndustryKnowledgeFolder`和`KnowledgeToken`合约
2. 创建`.env`文件（参考`.env.example`），并设置以下环境变量：
   - `ZEROG_PRIVATE_KEY`: 您的私钥
   - `FOLDER_ADDRESS`: 已部署的`IndustryKnowledgeFolder`合约地址

### 使用方法

在项目根目录下运行以下命令：

```bash
# 在ZeroG测试网上运行
npm run upload:mpc

# 在本地网络上运行
npm run upload:mpc:local
```

### 注意事项

- 确保`scripts/mpc.txt`文件存在且有内容
- 上传文件需要消耗gas费用
- 批准文件操作需要管理员权限
- 文件更新操作需要文件所有者权限