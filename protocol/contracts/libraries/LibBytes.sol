/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

/*
 * @author: Malteasy
 * @title: LibBytes
 */

library LibBytes {
    /*
     * @notice From Solidity Bytes Arrays Utils
     * @author Gonçalo Sá <goncalo.sa@consensys.net>
     */
    function toUint8(bytes memory _bytes, uint256 _start)
        internal
        pure
        returns (uint8)
    {
        require(_start + 1 >= _start, "toUint8_overflow");
        require(_bytes.length >= _start + 1, "toUint8_outOfBounds");
        uint8 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x1), _start))
        }

        return tempUint;
    }

    /*
     * @notice From Solidity Bytes Arrays Utils
     * @author Gonçalo Sá <goncalo.sa@consensys.net>
     */
    function toUint256(bytes memory _bytes, uint256 _start)
        internal
        pure
        returns (uint256)
    {
        require(_start + 32 >= _start, "toUint256_overflow");
        require(_bytes.length >= _start + 32, "toUint256_outOfBounds");
        uint256 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x20), _start))
        }

        return tempUint;
    }

    /**
     * @notice Loads a slice of a calldata bytes array into memory
     * @param b The calldata bytes array to load from
     * @param start The start of the slice
     * @param length The length of the slice
     */
    function sliceToMemory(
        bytes calldata b,
        uint256 start,
        uint256 length
    ) internal pure returns (bytes memory) {
        bytes memory memBytes = new bytes(length);
        for (uint256 i = 0; i < length; ++i) {
            memBytes[i] = b[start + i];
        }
        return memBytes;
    }

    /**
     * @notice slices bytes memory
     * @param b The memory bytes array to load from
     * @param start The start of the slice
     * @return sliced bytes
     */
    function sliceFrom(
        bytes memory b,
        uint256 start
    ) internal pure returns (bytes memory) {
        uint256 length = b.length - start;
        bytes memory memBytes = new bytes(length);
        for (uint256 i = 0; i < length; ++i) {
            memBytes[i] = b[start + i];
        }
        return memBytes;
    }
}
