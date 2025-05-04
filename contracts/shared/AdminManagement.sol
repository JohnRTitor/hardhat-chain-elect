// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.8;

/**
 * @title AdminManagement Abstract Contract
 * @notice Base contract implementing standardized admin management functionality
 * @dev Provides common admin functions that can be inherited by database contracts
 */
abstract contract AdminManagement {
    /// @notice Thrown when a non-owner attempts to perform an owner-only action
    error AdminManagement__NotOwner();

    /// @notice Thrown when a non-admin tries to access admin functionality
    error AdminManagement__NotAdmin();

    /// @notice Thrown when trying to add an address that's already an admin
    error AdminManagement__AlreadyAdmin();

    /// @notice Thrown when trying to remove an address that's not an admin
    error AdminManagement__AdminNotFound();

    /// @notice Thrown when an invalid address is provided
    error AdminManagement__InvalidAddress();

    // Owner of the contract
    address private immutable i_owner;

    // Admin system
    mapping(address => bool) private s_admins;
    address[] private s_adminAddresses;

    /// @notice Emitted when a new admin is added
    /// @param admin The address of the newly added admin
    /// @param owner The address that added the admin (owner)
    event AdminAdded(address indexed admin, address indexed owner);

    /// @notice Emitted when an admin is removed
    /// @param admin The address of the removed admin
    /// @param owner The address that removed the admin (owner)
    event AdminRemoved(address indexed admin, address indexed owner);

    /// @notice Restricts function access to the owner
    modifier onlyOwner() {
        if (msg.sender != i_owner) revert AdminManagement__NotOwner();
        _;
    }

    /// @notice Restricts function access to admins (including the owner)
    modifier onlyAdmin() {
        if (msg.sender != i_owner && !s_admins[msg.sender])
            revert AdminManagement__NotAdmin();
        _;
    }

    /// @notice Contract constructor, sets the deployer as the owner
    constructor() {
        i_owner = msg.sender;
    }

    /// @notice Add a new admin to the system
    /// @dev Only owner can call this function
    /// @param _adminAddress Address to be added as admin
    function addAdmin(address _adminAddress) external onlyOwner {
        if (_adminAddress == address(0))
            revert AdminManagement__InvalidAddress();
        if (s_admins[_adminAddress]) revert AdminManagement__AlreadyAdmin();

        s_admins[_adminAddress] = true;
        s_adminAddresses.push(_adminAddress);

        emit AdminAdded(_adminAddress, msg.sender);
    }

    /// @notice Remove an admin from the system
    /// @dev Only owner can call this function
    /// @param _adminAddress Address to be removed from admin role
    function removeAdmin(address _adminAddress) external onlyOwner {
        if (!s_admins[_adminAddress]) revert AdminManagement__AdminNotFound();

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
}
