/**
 * @title Candidate Contract
 * Purpose: let candidates register themselves, update themselves
 * Unenrolling/deleting is restricted to admins
 * Anyone can view the candidates and their details
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

error CandidateContract__NotEligible();
error CandidateContract__NotOwner();
error CandidateContract__AlreadyRegistered();
error CandidateContract__NotRegistered();

contract CandidateContract {
    struct Candidate {
        string name;
        uint256 age;
        string email;
        bool isRegistered;
    }

    address private immutable i_owner;
    mapping(address => Candidate) private s_candidates;
    address[] private s_candidateAddresses;

    event CandidateRegistered(address candidate);
    event CandidateUpdated(address candidate);
    event CandidateDeleted(address candidate);

    modifier onlyOwner() {
        if (msg.sender != i_owner) revert CandidateContract__NotOwner();
        _;
    }

    modifier onlyRegistered() {
        if (!s_candidates[msg.sender].isRegistered)
            revert CandidateContract__NotRegistered();
        _;
    }

    constructor() {
        i_owner = msg.sender;
    }

    function addCandidate(
        string memory _name,
        uint256 _age,
        string memory _email
    ) public {
        // candidate themselves should be at least 18
        if (_age < 18) revert CandidateContract__NotEligible();
        // don't let them reregister
        if (s_candidates[msg.sender].isRegistered)
            revert CandidateContract__AlreadyRegistered();

        s_candidates[msg.sender] = Candidate({
            name: _name,
            age: _age,
            email: _email,
            isRegistered: true
        });
        emit CandidateRegistered(msg.sender);
    }

    function updateCandidate(
        string memory _name,
        uint256 _age,
        string memory _email
    ) public onlyRegistered {
        s_candidates[msg.sender].name = _name;
        s_candidates[msg.sender].age = _age;
        s_candidates[msg.sender].email = _email;

        emit CandidateUpdated(msg.sender);
    }

    function deleteCandidate(address _candidateAddress) public onlyOwner {
        if (!s_candidates[_candidateAddress].isRegistered) {
            revert CandidateContract__NotRegistered();
        }

        delete s_candidates[_candidateAddress];

        for (uint256 i = 0; i < s_candidateAddresses.length; i++) {
            if (s_candidateAddresses[i] == _candidateAddress) {
                s_candidateAddresses[i] = s_candidateAddresses[
                    s_candidateAddresses.length - 1
                ];
                s_candidateAddresses.pop();
                break;
            }
        }
    }

    function getCandidateDetails(
        address _candidateAddress
    )
        public
        view
        returns (string memory name, uint256 age, string memory email)
    {
        Candidate memory candidate = s_candidates[_candidateAddress];
        return (candidate.name, candidate.age, candidate.email);
    }

    function getAllCandidates() public view returns (address[] memory) {
        return s_candidateAddresses;
    }

    function getMyCandidateDetails()
        public
        view
        onlyRegistered
        returns (string memory name, uint256 age, string memory email)
    {
        Candidate memory candidate = s_candidates[msg.sender];
        return (candidate.name, candidate.age, candidate.email);
    }
}
