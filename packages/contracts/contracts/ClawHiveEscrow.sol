// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract ReentrancyGuard {
    uint256 private _locked = 1;

    modifier nonReentrant() {
        require(_locked == 1, "reentrancy");
        _locked = 2;
        _;
        _locked = 1;
    }
}

contract ClawHiveEscrow is ReentrancyGuard {
    enum TaskStatus {
        None,
        Open,
        Accepted,
        Submitted,
        Verified,
        Paid,
        Cancelled,
        TimeoutReclaimed
    }

    struct Task {
        address requester;
        address worker;
        address verifier;
        uint256 budget;
        uint256 deadline;
        uint256 verifierFeeBps;
        bytes32 metadataHash;
        bytes32 submissionHash;
        string submissionURI;
        bytes32 verifierNoteHash;
        uint256 createdAt;
        uint256 acceptedAt;
        uint256 submittedAt;
        uint256 verifiedAt;
        TaskStatus status;
    }

    IERC20 public immutable usdc;
    uint256 public immutable gracePeriod;
    uint256 public taskCount;

    mapping(uint256 => Task) private tasks;

    event TaskCreated(
        uint256 indexed taskId,
        address indexed requester,
        uint256 budget,
        uint256 deadline,
        address verifier,
        uint256 verifierFeeBps,
        bytes32 metadataHash
    );
    event TaskAccepted(uint256 indexed taskId, address indexed worker);
    event WorkSubmitted(uint256 indexed taskId, bytes32 submissionHash, string submissionURI);
    event WorkVerified(uint256 indexed taskId, bool verdict, bytes32 verifierNoteHash);
    event PaymentReleased(uint256 indexed taskId, address indexed worker, uint256 workerAmount, uint256 verifierAmount);
    event TaskCancelled(uint256 indexed taskId);
    event TimeoutReclaimed(uint256 indexed taskId, address indexed requester, uint256 amount);

    constructor(address usdcAddress, uint256 gracePeriodSeconds) {
        require(usdcAddress != address(0), "usdc zero");
        usdc = IERC20(usdcAddress);
        gracePeriod = gracePeriodSeconds;
    }

    function createTask(
        uint256 budget,
        uint256 deadline,
        address verifier,
        uint256 verifierFeeBps,
        bytes32 metadataHash
    ) external returns (uint256 taskId) {
        require(budget > 0, "budget=0");
        require(deadline > block.timestamp, "deadline past");
        require(verifier != address(0), "verifier zero");
        require(verifierFeeBps <= 10_000, "fee too high");

        taskId = ++taskCount;

        tasks[taskId] = Task({
            requester: msg.sender,
            worker: address(0),
            verifier: verifier,
            budget: budget,
            deadline: deadline,
            verifierFeeBps: verifierFeeBps,
            metadataHash: metadataHash,
            submissionHash: bytes32(0),
            submissionURI: "",
            verifierNoteHash: bytes32(0),
            createdAt: block.timestamp,
            acceptedAt: 0,
            submittedAt: 0,
            verifiedAt: 0,
            status: TaskStatus.Open
        });

        _safeTransferFrom(address(usdc), msg.sender, address(this), budget);

        emit TaskCreated(taskId, msg.sender, budget, deadline, verifier, verifierFeeBps, metadataHash);
    }

    function acceptTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Open, "not open");
        require(msg.sender != task.requester, "requester cannot accept");

        task.worker = msg.sender;
        task.acceptedAt = block.timestamp;
        task.status = TaskStatus.Accepted;

        emit TaskAccepted(taskId, msg.sender);
    }

    function submitWork(uint256 taskId, bytes32 submissionHash, string calldata submissionURI) external {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Accepted, "not accepted");
        require(msg.sender == task.worker, "not worker");
        require(submissionHash != bytes32(0), "hash zero");
        require(bytes(submissionURI).length > 0, "uri empty");

        task.submissionHash = submissionHash;
        task.submissionURI = submissionURI;
        task.submittedAt = block.timestamp;
        task.status = TaskStatus.Submitted;

        emit WorkSubmitted(taskId, submissionHash, submissionURI);
    }

    function verifyWork(uint256 taskId, bool verdict, bytes32 verifierNoteHash) external {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Submitted, "not submitted");
        require(msg.sender == task.verifier, "not verifier");
        require(verdict, "mvp only pass");

        task.verifierNoteHash = verifierNoteHash;
        task.verifiedAt = block.timestamp;
        task.status = TaskStatus.Verified;

        emit WorkVerified(taskId, verdict, verifierNoteHash);
    }

    function releasePayment(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Verified, "not verified");

        task.status = TaskStatus.Paid;

        uint256 verifierAmount = (task.budget * task.verifierFeeBps) / 10_000;
        uint256 workerAmount = task.budget - verifierAmount;

        if (workerAmount > 0) {
            _safeTransfer(address(usdc), task.worker, workerAmount);
        }
        if (verifierAmount > 0) {
            _safeTransfer(address(usdc), task.verifier, verifierAmount);
        }

        emit PaymentReleased(taskId, task.worker, workerAmount, verifierAmount);
    }

    function cancelTask(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Open, "not open");
        require(msg.sender == task.requester, "not requester");

        task.status = TaskStatus.Cancelled;
        _safeTransfer(address(usdc), task.requester, task.budget);

        emit TaskCancelled(taskId);
    }

    function reclaimAfterTimeout(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Accepted || task.status == TaskStatus.Submitted, "bad status");
        require(msg.sender == task.requester, "not requester");
        require(block.timestamp > task.deadline + gracePeriod, "grace active");

        task.status = TaskStatus.TimeoutReclaimed;
        _safeTransfer(address(usdc), task.requester, task.budget);

        emit TimeoutReclaimed(taskId, task.requester, task.budget);
    }

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function _safeTransfer(address token, address to, uint256 value) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transfer failed");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transferFrom failed");
    }
}
