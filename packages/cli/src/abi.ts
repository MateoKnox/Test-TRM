export const ESCROW_ABI = [
  'function createTask(uint256 budget,uint256 deadline,address verifier,uint256 verifierFeeBps,bytes32 metadataHash) returns (uint256)',
  'function acceptTask(uint256 taskId)',
  'function submitWork(uint256 taskId,bytes32 submissionHash,string submissionURI)',
  'function verifyWork(uint256 taskId,bool verdict,bytes32 verifierNoteHash)',
  'function releasePayment(uint256 taskId)',
  'function cancelTask(uint256 taskId)',
  'function reclaimAfterTimeout(uint256 taskId)',
  'function taskCount() view returns (uint256)',
  'function getTask(uint256 taskId) view returns ((address requester,address worker,address verifier,uint256 budget,uint256 deadline,uint256 verifierFeeBps,bytes32 metadataHash,bytes32 submissionHash,string submissionURI,bytes32 verifierNoteHash,uint256 createdAt,uint256 acceptedAt,uint256 submittedAt,uint256 verifiedAt,uint8 status))',
  'event TaskCreated(uint256 indexed taskId,address indexed requester,uint256 budget,uint256 deadline,address verifier,uint256 verifierFeeBps,bytes32 metadataHash)',
  'event TaskAccepted(uint256 indexed taskId,address indexed worker)',
  'event WorkSubmitted(uint256 indexed taskId,bytes32 submissionHash,string submissionURI)',
  'event WorkVerified(uint256 indexed taskId,bool verdict,bytes32 verifierNoteHash)',
  'event PaymentReleased(uint256 indexed taskId,address indexed worker,uint256 workerAmount,uint256 verifierAmount)',
  'event TaskCancelled(uint256 indexed taskId)',
  'event TimeoutReclaimed(uint256 indexed taskId,address indexed requester,uint256 amount)',
] as const;

export const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function approve(address spender,uint256 amount) returns (bool)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function mint(address to,uint256 amount)',
] as const;
