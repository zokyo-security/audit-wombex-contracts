// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
import "../WmxMath.sol";

contract WmxMathLibTest {
    function testWmxMathMin(uint256 a, uint256 b) public view returns (uint256) {
        return WmxMath.min(a, b);
    }

    function testWmxMathAdd(uint256 a, uint256 b) public view returns (uint256) {
        return WmxMath.add(a, b);
    }

    function testWmxMathSub(uint256 a, uint256 b) public view returns (uint256) {
        return WmxMath.sub(a, b);
    }

    function testWmxMathMul(uint256 a, uint256 b) public view returns (uint256) {
        return WmxMath.mul(a, b);
    }

    function testWmxMathDiv(uint256 a, uint256 b) public view returns (uint256) {
        return WmxMath.div(a, b);
    }

    function testWmxMathAverage(uint256 a, uint256 b) public view returns (uint256) {
        return WmxMath.average(a, b);
    }

    function testWmxMathTo224(uint256 a) public view returns (uint256) {
        return WmxMath.to224(a);
    }

    function testWmxMathTo128(uint256 a) public view returns (uint256) {
        return WmxMath.to128(a);
    }

    function testWmxMathTo112(uint256 a) public view returns (uint256) {
        return WmxMath.to112(a);
    }

    function testWmxMathTo96(uint256 a) public view returns (uint256) {
        return WmxMath.to96(a);
    }

    function testWmxMathTo32(uint256 a) public view returns (uint256) {
        return WmxMath.to32(a);
    }

    function testWmxMath32Sub(uint32 a, uint32 b) public view returns (uint32) {
        return WmxMath32.sub(a, b);
    }

    function testWmxMath112Add(uint112 a, uint112 b) public view returns (uint112) {
        return WmxMath112.add(a, b);
    }

    function testWmxMath112Sub(uint112 a, uint112 b) public view returns (uint112) {
        return WmxMath112.sub(a, b);
    }

    function testWmxMath224Add(uint224 a, uint224 b) public view returns (uint224) {
        return WmxMath224.add(a, b);
    }
}
