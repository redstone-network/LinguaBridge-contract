// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./KnowledgeToken.sol";

contract IndustryKnowledgeFolder {
    struct FileEntry {
        bytes32 hash;       // 文件内容哈希
        uint256 size;       // 文件大小
        address owner;      // 所有者地址
        uint256 timestamp;  // 创建时间戳
        uint8 status;       // 0-未审核 1-已审核 2-已拒绝
        string category;    // 文件类别
        string metadata;    // 附加元数据 (JSON格式的字符串)
    }

    mapping(string => FileEntry) public files;
    string[] public fileList;
    address public admin;
    KnowledgeToken public tokenContract;

    // 按类别组织文件
    mapping(string => string[]) public categoryFiles;
    // 按用户组织文件
    mapping(address => string[]) public userFiles;
    // 按状态组织文件
    mapping(uint8 => string[]) public statusFiles;
    
    // 统计信息
    uint256 public totalApprovedFiles;
    uint256 public totalRejectedFiles;
    uint256 public totalPendingFiles;
    uint256 public totalTokensRewarded;
    
    event FileUploaded(string indexed filename, address uploader, string category);
    event FileApproved(string indexed filename, uint256 reward);
    event FileRejected(string indexed filename, string reason);
    event FileUpdated(string indexed filename, bytes32 newHash, uint256 newSize);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin,  unicode"只有管理员可以执行此操作");
        _;
    }

    modifier onlyFileOwner(string memory filename) {
        require(files[filename].owner == msg.sender,  unicode"只有文件所有者可以执行此操作");
        _;
    }

    constructor(address _tokenAddress) {
        admin = msg.sender;
        tokenContract = KnowledgeToken(_tokenAddress);
    }

    function uploadFile(
        string memory filename, 
        bytes32 hash, 
        uint256 size, 
        string memory category,
        string memory metadata
    ) external {
        require(files[filename].timestamp == 0,  unicode"文件已存在");
        require(size > 0,  unicode"文件大小必须为正数");
        require(bytes(category).length > 0,  unicode"类别不能为空");
        
        files[filename] = FileEntry(hash, size, msg.sender, block.timestamp, 0, category, metadata);
        fileList.push(filename);
        categoryFiles[category].push(filename);
        userFiles[msg.sender].push(filename);
        statusFiles[0].push(filename);
        
        totalPendingFiles++;
        
        emit FileUploaded(filename, msg.sender, category);
    }

    function approveFile(string memory filename, uint256 rewardAmount) external onlyAdmin {
        require(files[filename].timestamp > 0,  unicode"文件不存在");
        require(files[filename].status == 0,  unicode"文件不处于待审核状态");
        
        files[filename].status = 1;
        
        // 更新状态集合
        _removeFromStatusFiles(filename, 0);
        statusFiles[1].push(filename);
        
        // 更新统计信息
        totalPendingFiles--;
        totalApprovedFiles++;
        totalTokensRewarded += rewardAmount;
        
        // 向文件所有者铸造新代币
        tokenContract.mint(files[filename].owner, rewardAmount);
        
        emit FileApproved(filename, rewardAmount);
    }
    
    function rejectFile(string memory filename, string memory reason) external onlyAdmin {
        require(files[filename].timestamp > 0,  unicode"文件不存在");
        require(files[filename].status == 0,  unicode"文件不处于待审核状态");
        
        files[filename].status = 2;
        
        // 更新状态集合
        _removeFromStatusFiles(filename, 0);
        statusFiles[2].push(filename);
        
        // 更新统计信息
        totalPendingFiles--;
        totalRejectedFiles++;
        
        emit FileRejected(filename, reason);
    }
    
    function updateFile(
        string memory filename, 
        bytes32 newHash, 
        uint256 newSize,
        string memory newMetadata
    ) external onlyFileOwner(filename) {
        require(files[filename].timestamp > 0,  unicode"文件不存在");
        require(files[filename].status != 1,  unicode"已审核的文件不能更新");
        require(newSize > 0,  unicode"文件大小必须为正数");
        
        files[filename].hash = newHash;
        files[filename].size = newSize;
        files[filename].metadata = newMetadata;
        files[filename].timestamp = block.timestamp;
        
        // 如果文件被拒绝，将其状态设回待审核
        if (files[filename].status == 2) {
            files[filename].status = 0;
            
            // 更新状态集合
            _removeFromStatusFiles(filename, 2);
            statusFiles[0].push(filename);
            
            // 更新统计信息
            totalRejectedFiles--;
            totalPendingFiles++;
        }
        
        emit FileUpdated(filename, newHash, newSize);
    }
    
    // 从状态集合中移除文件的辅助函数
    function _removeFromStatusFiles(string memory filename, uint8 status) internal {
        string[] storage collection = statusFiles[status];
        for (uint i = 0; i < collection.length; i++) {
            if (keccak256(bytes(collection[i])) == keccak256(bytes(filename))) {
                // 用最后一个元素替换并移除
                collection[i] = collection[collection.length - 1];
                collection.pop();
                break;
            }
        }
    }
    
    // 查询函数
    function getFilesByCategory(string memory category) external view returns (string[] memory) {
        return categoryFiles[category];
    }
    
    function getUserFiles(address user) external view returns (string[] memory) {
        return userFiles[user];
    }
    
    function getFilesByStatus(uint8 status) external view returns (string[] memory) {
        require(status <= 2,  unicode"无效的状态");
        return statusFiles[status];
    }
    
    function getFileCount() external view returns (uint256) {
        return fileList.length;
    }
    
    function getFileDetails(string memory filename) external view returns (
        bytes32 hash,
        uint256 size,
        address owner,
        uint256 timestamp,
        uint8 status,
        string memory category,
        string memory metadata
    ) {
        FileEntry storage file = files[filename];
        require(file.timestamp > 0,  unicode"文件不存在");
        
        return (
            file.hash,
            file.size,
            file.owner,
            file.timestamp,
            file.status,
            file.category,
            file.metadata
        );
    }
    
    // 管理员函数
    function changeAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0),  unicode"无效地址");
        address oldAdmin = admin;
        admin = newAdmin;
        emit AdminChanged(oldAdmin, newAdmin);
    }
    
    function setTokenContract(address newTokenAddress) external onlyAdmin {
        require(newTokenAddress != address(0),  unicode"无效地址");
        tokenContract = KnowledgeToken(newTokenAddress);
    }
} 