// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {ICandidateDatabase} from "./interfaces/ICandidateDatabase.sol";

/**
 * @title CandidateDatabase Contract
 * @author Masum Reza
 * @notice This contract allows candidates to self-register and update their profiles.
 * @dev Only the admin (owner) can delete/unregister candidates. Anyone can view public candidate data.
 */

/// @notice Thrown when a candidate under the age of 18 tries to register
error CandidateDatabase__NotEligible();

/// @notice Thrown when a non-owner attempts to perform an admin-only action
error CandidateDatabase__NotOwner();

/// @notice Thrown when a candidate attempts to register again after already being registered
error CandidateDatabase__AlreadyRegistered();

/// @notice Thrown when an unregistered candidate attempts a restricted action
error CandidateDatabase__NotRegistered();

/// @notice Thrown when import operations fail
error CandidateDatabase__ImportFailed();

/// @notice Thrown when an invalid address is provided
error CandidateDatabase__InvalidAddress();

/// @notice Thrown when a non-admin tries to access admin functionality
error CandidateDatabase__NotAdmin();

/// @notice Thrown when trying to add an address that's already an admin
error CandidateDatabase__AlreadyAdmin();

/// @notice Thrown when trying to remove an address that's not an admin
error CandidateDatabase__AdminNotFound();

contract CandidateDatabase {
    /// @notice Candidate struct holding personal information and registration status
    struct Candidate {
        string name;
        uint256 age;
        string email;
        string qualifications;
        string manifesto;
        uint256 registrationTimestamp;
        bool isRegistered;
    }

    address private immutable i_owner;
    mapping(address => Candidate) private s_candidates;
    address[] private s_candidateAddresses;

    // Admin system
    mapping(address => bool) private s_admins;
    address[] private s_adminAddresses;

    /// @notice Emitted when a new candidate is registered
    /// @param candidate The address of the newly registered candidate
    event CandidateRegistered(address indexed candidate);

    /// @notice Emitted when a candidate updates their profile
    /// @param candidate The address of the updated candidate
    event CandidateUpdated(address indexed candidate);

    /// @notice Emitted when a candidate is deleted/unregistered by the admin
    /// @param candidate The address of the deleted candidate
    event CandidateDeleted(address indexed candidate);

    /// @notice Emitted when candidate data is imported
    /// @param sourceContract Address of the contract data was imported from
    /// @param candidatesImported Number of candidates successfully imported
    event CandidatesImported(
        address indexed sourceContract,
        uint256 candidatesImported
    );

    /// @notice Emitted when admin adds a candidate
    /// @param candidate The address of the candidate added by admin
    /// @param admin The admin who added the candidate
    event AdminAddedCandidate(address indexed candidate, address indexed admin);

    /// @notice Emitted when admin updates a candidate
    /// @param candidate The address of the candidate updated by admin
    /// @param admin The admin who updated the candidate
    event AdminUpdatedCandidate(
        address indexed candidate,
        address indexed admin
    );

    /// @notice Emitted when a new admin is added
    /// @param admin The address of the newly added admin
    /// @param owner The address that added the admin (owner)
    event AdminAdded(address indexed admin, address indexed owner);

    /// @notice Emitted when an admin is removed
    /// @param admin The address of the removed admin
    /// @param owner The address that removed the admin (owner)
    event AdminRemoved(address indexed admin, address indexed owner);

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

    /// @notice Restricts function access to admins (including the owner)
    modifier onlyAdmin() {
        if (msg.sender != i_owner && !s_admins[msg.sender])
            revert CandidateDatabase__NotAdmin();
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
    /// @param _qualifications Candidate's educational qualifications
    /// @param _manifesto Candidate's election manifesto or platform
    function addCandidate(
        string memory _name,
        uint256 _age,
        string memory _email,
        string memory _qualifications,
        string memory _manifesto
    ) public {
        if (_age < 18) revert CandidateDatabase__NotEligible();
        if (s_candidates[msg.sender].isRegistered)
            revert CandidateDatabase__AlreadyRegistered();

        s_candidates[msg.sender] = Candidate({
            name: _name,
            age: _age,
            email: _email,
            qualifications: _qualifications,
            manifesto: _manifesto,
            registrationTimestamp: block.timestamp,
            isRegistered: true
        });
        s_candidateAddresses.push(msg.sender);
        emit CandidateRegistered(msg.sender);
    }

    /// @notice Update your candidate profile
    /// @param _name Updated name
    /// @param _age Updated age
    /// @param _email Updated email address
    /// @param _qualifications Updated qualifications
    /// @param _manifesto Updated manifesto
    function updateCandidate(
        string memory _name,
        uint256 _age,
        string memory _email,
        string memory _qualifications,
        string memory _manifesto
    ) public onlyRegistered {
        s_candidates[msg.sender].name = _name;
        s_candidates[msg.sender].age = _age;
        s_candidates[msg.sender].email = _email;
        s_candidates[msg.sender].qualifications = _qualifications;
        s_candidates[msg.sender].manifesto = _manifesto;

        emit CandidateUpdated(msg.sender);
    }

    /// @notice Delete a candidate's registration (admin only)
    /// @param _candidateAddress The address of the candidate to remove
    function deleteCandidate(address _candidateAddress) public onlyAdmin {
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

    /// @notice Admin function to add a candidate directly
    /// @dev Only owner/admins can call this function
    /// @param _candidateAddress Address of the candidate to add
    /// @param _name Name of the candidate
    /// @param _age Age of the candidate
    /// @param _email Email of the candidate
    /// @param _qualifications Qualifications of the candidate
    /// @param _manifesto Manifesto of the candidate
    function adminAddCandidate(
        address _candidateAddress,
        string memory _name,
        uint256 _age,
        string memory _email,
        string memory _qualifications,
        string memory _manifesto
    ) external onlyAdmin {
        if (_candidateAddress == address(0))
            revert CandidateDatabase__InvalidAddress();
        if (_age < 18) revert CandidateDatabase__NotEligible();

        // Check if already registered
        if (s_candidates[_candidateAddress].isRegistered)
            revert CandidateDatabase__AlreadyRegistered();

        s_candidates[_candidateAddress] = Candidate({
            name: _name,
            age: _age,
            email: _email,
            qualifications: _qualifications,
            manifesto: _manifesto,
            registrationTimestamp: block.timestamp,
            isRegistered: true
        });

        s_candidateAddresses.push(_candidateAddress);

        emit AdminAddedCandidate(_candidateAddress, msg.sender);
    }

    /// @notice Admin function to update candidate details
    /// @dev Only owner/admins can call this function
    /// @param _candidateAddress Address of the candidate to update
    /// @param _name Updated name
    /// @param _age Updated age
    /// @param _email Updated email
    /// @param _qualifications Updated qualifications
    /// @param _manifesto Updated manifesto
    function adminUpdateCandidate(
        address _candidateAddress,
        string memory _name,
        uint256 _age,
        string memory _email,
        string memory _qualifications,
        string memory _manifesto
    ) external onlyAdmin {
        if (!s_candidates[_candidateAddress].isRegistered)
            revert CandidateDatabase__NotRegistered();

        Candidate storage candidate = s_candidates[_candidateAddress];

        // Update details but preserve timestamp
        candidate.name = _name;
        candidate.age = _age;
        candidate.email = _email;
        candidate.qualifications = _qualifications;
        candidate.manifesto = _manifesto;

        emit AdminUpdatedCandidate(_candidateAddress, msg.sender);
    }

    /// @notice Import a specific candidate from another CandidateDatabase contract
    /// @dev Only owner/admins can call this function
    /// @param _sourceContract The address of the source CandidateDatabase contract
    /// @param _candidateAddress The address of the candidate to import
    function adminImportCandidate(
        address _sourceContract,
        address _candidateAddress
    ) external onlyAdmin {
        // Skip if candidate is already registered in this contract
        if (s_candidates[_candidateAddress].isRegistered) {
            revert CandidateDatabase__AlreadyRegistered();
        }

        ICandidateDatabase source = ICandidateDatabase(_sourceContract);

        try source.getCandidateDetails(_candidateAddress) returns (
            string memory name,
            uint256 age,
            string memory email,
            string memory qualifications,
            string memory manifesto,
            uint256 registrationTimestamp
        ) {
            // Add candidate to this contract
            s_candidates[_candidateAddress] = Candidate({
                name: name,
                age: age,
                email: email,
                qualifications: qualifications,
                manifesto: manifesto,
                registrationTimestamp: registrationTimestamp,
                isRegistered: true
            });

            s_candidateAddresses.push(_candidateAddress);
            emit CandidateRegistered(_candidateAddress);

            uint256 importedCount = 1;
            emit CandidatesImported(_sourceContract, importedCount);
        } catch {
            revert CandidateDatabase__ImportFailed();
        }
    }

    /// @notice Batch import selected candidates from another CandidateDatabase contract
    /// @dev Only owner/admins can call this function
    /// @param _sourceContract The address of the source CandidateDatabase contract
    /// @param _candidateAddresses Array of candidate addresses to import
    function adminBatchImportCandidates(
        address _sourceContract,
        address[] calldata _candidateAddresses
    ) external onlyAdmin {
        ICandidateDatabase source = ICandidateDatabase(_sourceContract);
        uint256 importedCount = 0;

        for (uint256 i = 0; i < _candidateAddresses.length; i++) {
            address candidateAddress = _candidateAddresses[i];

            // Skip if candidate is already registered
            if (s_candidates[candidateAddress].isRegistered) {
                continue;
            }

            try source.getCandidateDetails(candidateAddress) returns (
                string memory name,
                uint256 age,
                string memory email,
                string memory qualifications,
                string memory manifesto,
                uint256 registrationTimestamp
            ) {
                // Add candidate to this contract
                s_candidates[candidateAddress] = Candidate({
                    name: name,
                    age: age,
                    email: email,
                    qualifications: qualifications,
                    manifesto: manifesto,
                    registrationTimestamp: registrationTimestamp,
                    isRegistered: true
                });

                s_candidateAddresses.push(candidateAddress);
                emit CandidateRegistered(candidateAddress);
                importedCount++;
            } catch {
                // Continue to next candidate if this one fails
                continue;
            }
        }

        emit CandidatesImported(_sourceContract, importedCount);
    }

    /// @notice Import all candidates from another CandidateDatabase contract
    /// @dev Only owner/admins can call this function
    /// @param _sourceContract The address of the source CandidateDatabase contract
    function adminImportAllCandidates(
        address _sourceContract
    ) external onlyAdmin {
        ICandidateDatabase source = ICandidateDatabase(_sourceContract);
        address[] memory candidates;

        // Use try/catch to handle potential errors from external calls
        try source.getAllCandidates() returns (address[] memory _candidates) {
            candidates = _candidates;
        } catch {
            revert CandidateDatabase__ImportFailed();
        }

        uint256 importedCount = 0;

        for (uint256 i = 0; i < candidates.length; i++) {
            address candidateAddress = candidates[i];

            // Skip if candidate is already registered in this contract
            if (s_candidates[candidateAddress].isRegistered) {
                continue;
            }

            try source.getCandidateDetails(candidateAddress) returns (
                string memory name,
                uint256 age,
                string memory email,
                string memory qualifications,
                string memory manifesto,
                uint256 registrationTimestamp
            ) {
                // Add candidate to this contract
                s_candidates[candidateAddress] = Candidate({
                    name: name,
                    age: age,
                    email: email,
                    qualifications: qualifications,
                    manifesto: manifesto,
                    registrationTimestamp: registrationTimestamp,
                    isRegistered: true
                });

                s_candidateAddresses.push(candidateAddress);
                emit CandidateRegistered(candidateAddress);
                importedCount++;
            } catch {
                // Continue to next candidate if this one fails
                continue;
            }
        }

        emit CandidatesImported(_sourceContract, importedCount);
    }

    /// @notice Add a new admin to the system
    /// @dev Only owner can call this function
    /// @param _adminAddress Address to be added as admin
    function addAdmin(address _adminAddress) external onlyOwner {
        if (_adminAddress == address(0))
            revert CandidateDatabase__InvalidAddress();
        if (s_admins[_adminAddress]) revert CandidateDatabase__AlreadyAdmin();

        s_admins[_adminAddress] = true;
        s_adminAddresses.push(_adminAddress);

        emit AdminAdded(_adminAddress, msg.sender);
    }

    /// @notice Remove an admin from the system
    /// @dev Only owner can call this function
    /// @param _adminAddress Address to be removed from admin role
    function removeAdmin(address _adminAddress) external onlyOwner {
        if (!s_admins[_adminAddress]) revert CandidateDatabase__AdminNotFound();

        // Remove admin from mapping
        delete s_admins[_adminAddress];

        // Remove from the admin array using swap and pop
        for (uint256 i = 0; i < s_adminAddresses.length; i++) {
            if (s_adminAddresses[i] == _adminAddress) {
                s_adminAddresses[i] = s_adminAddresses[
                    s_adminAddresses.length - 1
                ];
                s_adminAddresses.pop();
                break;
            }
        }

        emit AdminRemoved(_adminAddress, msg.sender);
    }

    /// @notice Check if an address is an admin
    /// @param _address Address to check
    /// @return True if the address is an admin, false otherwise
    function isAdmin(address _address) public view returns (bool) {
        return _address == i_owner || s_admins[_address];
    }

    /// @notice Get the total number of admins (excluding owner)
    /// @return The count of admins
    function getAdminCount() public view returns (uint256) {
        return s_adminAddresses.length;
    }

    /// @notice Get addresses of all admins (excluding owner)
    /// @return Array of admin addresses
    function getAllAdmins() public view returns (address[] memory) {
        return s_adminAddresses;
    }

    /// @notice Get the contract owner address
    /// @return The address of the contract owner
    function getOwner() public view returns (address) {
        return i_owner;
    }

    /// @notice Check if the caller is an admin
    /// @return True if the caller is an admin, false otherwise
    function amIAdmin() public view returns (bool) {
        return isAdmin(msg.sender);
    }

    /// @notice Get full details of a specific candidate
    /// @param _candidateAddress Address of the candidate
    /// @return name The name of the candidate
    /// @return age The age of the candidate
    /// @return email The email address of the candidate
    /// @return qualifications The qualifications of the candidate
    /// @return manifesto The election manifesto of the candidate
    /// @return registrationTimestamp When the candidate registered
    function getCandidateDetails(
        address _candidateAddress
    )
        public
        view
        returns (
            string memory name,
            uint256 age,
            string memory email,
            string memory qualifications,
            string memory manifesto,
            uint256 registrationTimestamp
        )
    {
        if (!s_candidates[_candidateAddress].isRegistered) {
            revert CandidateDatabase__NotRegistered();
        }
        Candidate memory candidate = s_candidates[_candidateAddress];
        return (
            candidate.name,
            candidate.age,
            candidate.email,
            candidate.qualifications,
            candidate.manifesto,
            candidate.registrationTimestamp
        );
    }

    /// @notice Get the list of all registered candidate addresses
    /// @return Array of candidate wallet addresses
    function getAllCandidates() public view returns (address[] memory) {
        return s_candidateAddresses;
    }

    /// @notice Get your full candidate details
    /// @return name Your name
    /// @return age Your age
    /// @return email Your email
    /// @return qualifications Your qualifications
    /// @return manifesto Your election manifesto
    /// @return registrationTimestamp When you registered
    function getMyCandidateDetails()
        public
        view
        onlyRegistered
        returns (
            string memory name,
            uint256 age,
            string memory email,
            string memory qualifications,
            string memory manifesto,
            uint256 registrationTimestamp
        )
    {
        Candidate memory candidate = s_candidates[msg.sender];
        return (
            candidate.name,
            candidate.age,
            candidate.email,
            candidate.qualifications,
            candidate.manifesto,
            candidate.registrationTimestamp
        );
    }

    /// @notice Get your own registration status
    /// @return isRegistered Whether you are registered for a election
    function getMyRegistrationStatus() public view returns (bool isRegistered) {
        return s_candidates[msg.sender].isRegistered;
    }

    /// @notice Get a candidate's registration status
    /// @param _candidateAddress Address of the candidate
    /// @return isRegistered Whether the candidate is registered for a election
    function getCandidateRegistrationStatus(
        address _candidateAddress
    ) public view returns (bool isRegistered) {
        return s_candidates[_candidateAddress].isRegistered;
    }

    /// @notice Get number of registered candidates
    /// @return count The number of registered candidates
    function getCandidateCount() public view returns (uint256 count) {
        return s_candidateAddresses.length;
    }
}
