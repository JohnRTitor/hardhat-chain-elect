// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

error VoterContract__NotEligible();
error VoterContract__NotRegistered();
error VoterContract__AlreadyRegistered();
error VoterContract__NotOwner();
error VoterContract__CannotUpdateAfterVoting();

// TODO: allow admin to update info
// TODO: investigate if we need something else/more
// TODO: complete NatSpec comments

contract VoterContract {
    struct Voter {
        string name;
        uint256 age;
        bool hasVoted;
        bool isRegistered;
    }

    address private immutable i_owner;
    mapping(address => Voter) private s_voters;
    address[] private s_voterAddresses;

    event VoterRegistered(address voter);
    event VoterUpdated(address voter);
    event VoterVoted(address voter);

    /// @notice functions with this modifier can only be called by registered voters
    modifier onlyRegistered() {
        if (!s_voters[msg.sender].isRegistered)
            revert VoterContract__NotRegistered();
        // voter is registered, so perform the action
        _;
    }

    /// @notice only owner/election manager should be allowed to perform certain actions
    modifier onlyOwner() {
        if (msg.sender != i_owner) revert VoterContract__NotOwner();
        _;
    }

    constructor() {
        i_owner = msg.sender;
    }

    function addVoter(string memory _name, uint256 _age) public {
        // only ages people above or equal to 18 is allowed to register
        if (_age < 18) revert VoterContract__NotEligible();
        // make sure the voter is not already registered
        if (s_voters[msg.sender].isRegistered)
            revert VoterContract__AlreadyRegistered();

        s_voters[msg.sender] = Voter({
            name: _name,
            age: _age,
            hasVoted: false,
            isRegistered: true
        });

        emit VoterRegistered(msg.sender);
    }

    /// @notice only registered voters can update their information
    /// you are not allowed to update your information after voting
    function updateVoter(
        string memory _name,
        uint256 _age
    ) public onlyRegistered {
        if (s_voters[msg.sender].hasVoted)
            revert VoterContract__CannotUpdateAfterVoting();

        s_voters[msg.sender].name = _name;
        s_voters[msg.sender].age = _age;

        emit VoterUpdated(msg.sender);
    }

    function deleteVoter(address _voterAddress) public onlyOwner {
        if (!s_voters[_voterAddress].isRegistered) {
            revert VoterContract__NotRegistered();
        }

        // remove voter from mapping
        delete s_voters[_voterAddress];

        // remove voter from array
        for (uint256 i = 0; i < s_voterAddresses.length; i++) {
            // first we find the index of the voter
            if (s_voterAddresses[i] == _voterAddress) {
                // since we can't remove the element directly, we move the last element to its position
                s_voterAddresses[i] = s_voterAddresses[
                    s_voterAddresses.length - 1
                ];
                // and then pop the last element, so list stays the same but without the deleted element
                s_voterAddresses.pop();
                break;
            }
        }
    }

    // TODO: ask investigate if we should only allow the owner to mark as markVoted
    // TODO: implement stuff, call this from an external contract
    function markVoted(address _voter) public onlyOwner {
        s_voters[_voter].hasVoted = true;

        emit VoterVoted(_voter);
    }

    /// @notice Get details of a voter
    /// @dev Should only be called by the owner/election manager
    function getVoterDetails(
        address _voterAddress
    )
        public
        view
        onlyOwner
        returns (string memory name, uint256 age, bool hasVoted)
    {
        Voter memory voter = s_voters[_voterAddress];
        return (voter.name, voter.age, voter.hasVoted);
    }

    // @return an array of all registered voter addresses
    // @dev This function is only accessible by the owner/election manager
    function getAllVoters() public view onlyOwner returns (address[] memory) {
        return s_voterAddresses;
    }

    /// @notice Get details of yourself
    /// Can be called by any registered voter
    function getMyDetails()
        public
        view
        onlyRegistered
        returns (string memory name, uint256 age, bool hasVoted)
    {
        Voter memory voter = s_voters[msg.sender];
        return (voter.name, voter.age, voter.hasVoted);
    }
}
