/**
 * @title CandidateDatabase Contract
 * @author Masum Reza
 * @notice This contract allows candidates to self-register and update their profiles.
 * @dev Only the admin (owner) can delete/unregister candidates. Anyone can view public candidate data.
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

/// @notice Thrown when a candidate under the age of 18 tries to register
error CandidateDatabase__NotEligible();

/// @notice Thrown when a non-owner attempts to perform an admin-only action
error CandidateDatabase__NotOwner();

/// @notice Thrown when a candidate attempts to register again after already being registered
error CandidateDatabase__AlreadyRegistered();

/// @notice Thrown when an unregistered candidate attempts a restricted action
error CandidateDatabase__NotRegistered();

contract CandidateDatabase {
    /// @notice Candidate struct holding personal information and registration status
    struct Candidate {
        string name;
        uint256 age;
        string email;
        bool isRegistered;
    }

    address private immutable i_owner;
    mapping(address => Candidate) private s_candidates;
    address[] private s_candidateAddresses;

    /// @notice Emitted when a new candidate is registered
    /// @param candidate The address of the newly registered candidate
    event CandidateRegistered(address indexed candidate);

    /// @notice Emitted when a candidate updates their profile
    /// @param candidate The address of the updated candidate
    event CandidateUpdated(address indexed candidate);

    /// @notice Emitted when a candidate is deleted/unregistered by the admin
    /// @param candidate The address of the deleted candidate
    event CandidateDeleted(address indexed candidate);

    /// @notice Modifier to restrict access to contract owner (admin)
    modifier onlyOwner() {
        if (msg.sender != i_owner) revert CandidateDatabase__NotOwner();
        _;
    }

    /// @notice Modifier to restrict access to registered candidates only
    modifier onlyRegistered() {
        if (!s_candidates[msg.sender].isRegistered)
            revert CandidateDatabase__NotRegistered();
        _;
    }

    /// @notice Contract constructor sets the deployer as the owner
    constructor() {
        i_owner = msg.sender;
    }

    /// @notice Register yourself as a candidate
    /// @param _name Candidate's full name
    /// @param _age Candidate's age (must be 18+)
    /// @param _email Candidate's email address
    function addCandidate(
        string memory _name,
        uint256 _age,
        string memory _email
    ) public {
        if (_age < 18) revert CandidateDatabase__NotEligible();
        if (s_candidates[msg.sender].isRegistered)
            revert CandidateDatabase__AlreadyRegistered();

        s_candidates[msg.sender] = Candidate({
            name: _name,
            age: _age,
            email: _email,
            isRegistered: true
        });
        s_candidateAddresses.push(msg.sender);
        emit CandidateRegistered(msg.sender);
    }

    /// @notice Update your candidate profile
    /// @param _name Updated name
    /// @param _age Updated age
    /// @param _email Updated email address
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

    /// @notice Delete a candidate's registration (admin only)
    /// @param _candidateAddress The address of the candidate to remove
    function deleteCandidate(address _candidateAddress) public onlyOwner {
        if (!s_candidates[_candidateAddress].isRegistered) {
            revert CandidateDatabase__NotRegistered();
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

        emit CandidateDeleted(_candidateAddress);
    }

    /// @notice Retrieve details of a specific candidate
    /// @param _candidateAddress The address of the candidate
    /// @return name The name of the candidate
    /// @return age The age of the candidate
    /// @return email The email address of the candidate
    function getCandidateDetails(
        address _candidateAddress
    )
        public
        view
        returns (string memory name, uint256 age, string memory email)
    {
        if (!s_candidates[_candidateAddress].isRegistered) {
            revert CandidateDatabase__NotRegistered();
        }
        Candidate memory candidate = s_candidates[_candidateAddress];
        return (candidate.name, candidate.age, candidate.email);
    }

    /// @notice Get the list of all registered candidate addresses
    /// @return Array of candidate wallet addresses
    function getAllCandidates() public view returns (address[] memory) {
        return s_candidateAddresses;
    }

    /// @notice Retrieve your own candidate profile
    /// @return name Your name
    /// @return age Your age
    /// @return email Your email
    function getMyCandidateDetails()
        public
        view
        onlyRegistered
        returns (string memory name, uint256 age, string memory email)
    {
        Candidate memory candidate = s_candidates[msg.sender];
        return (candidate.name, candidate.age, candidate.email);
    }

    /// @notice Get your own registration status
    /// @return isRegistered Whether you are registered for a election
    function getMyRegistrationStatus() public view returns (bool isRegistered) {
        if (!s_candidates[msg.sender].isRegistered) {
            return false;
        }
        return true;
    }

    /// @notice Get a candidate's registration status
    /// @param _candidateAddress Address of the candidate
    /// @return isRegistered Whether the candidate is registered for a election
    function getCandidateRegistrationStatus(
        address _candidateAddress
    ) public view returns (bool isRegistered) {
        if (!s_candidates[_candidateAddress].isRegistered) {
            return false;
        }
        return true;
    }
}
