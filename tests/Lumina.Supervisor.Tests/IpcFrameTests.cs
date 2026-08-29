using System.Text;
using Lumina.Supervisor.Errors;
using Lumina.Supervisor.Ipc;
using Xunit;

namespace Lumina.Supervisor.Tests;

public class IpcFrameTests
{
    [Fact]
    public void RoundTripSmallJson()
    {
        var json = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{}}");
        var frame = IpcFrame.Encode(json);
        Assert.Equal(json.Length, IpcFrame.DecodeLength(frame));
        var env = IpcCodec.DecodeUtf8(json);
        Assert.Equal("pause", env.Type);
    }

    [Fact]
    public void ZeroLengthRejected()
    {
        Assert.Throws<SupervisorException>(() => IpcFrame.DecodeLength(new byte[] { 0, 0, 0, 0 }));
    }

    [Fact]
    public void OversizeRejected()
    {
        var hdr = new byte[4];
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32LittleEndian(hdr, (uint)ProtocolConstants.MaxControlFrameBytes + 1);
        var ex = Assert.Throws<SupervisorException>(() => IpcFrame.DecodeLength(hdr));
        Assert.Equal(SupervisorErrorCode.FrameTooLarge, ex.Code);
    }

    [Fact]
    public void InvalidUtf8Rejected()
    {
        var bad = new byte[] { 0xFF, 0xFE, 0x80 };
        var ex = Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(bad));
        Assert.Equal(SupervisorErrorCode.InvalidUtf8, ex.Code);
    }

    [Fact]
    public void MissingPayloadRejected()
    {
        var json = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\"}");
        Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(json));
    }

    [Fact]
    public void ExtraFieldRejected()
    {
        var json = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{},\"nope\":1}");
        Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(json));
    }

    [Fact]
    public void WrongVersionRejected()
    {
        var json = Encoding.UTF8.GetBytes("{\"protocol_version\":2,\"job_id\":\"a\",\"seq\":0,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{}}");
        var ex = Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(json));
        Assert.Equal(SupervisorErrorCode.ProtocolVersionUnsupported, ex.Code);
    }

    [Fact]
    public void EventInCommandDirectionRejectedByValidator()
    {
        var json = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"event\",\"type\":\"heartbeat\",\"payload\":{}}");
        var env = IpcCodec.DecodeUtf8(json);
        Assert.Throws<SupervisorException>(() => ProtocolValidator.ValidateDirection(env, "command"));
    }

    [Fact]
    public void DuplicateSeqRejected()
    {
        Assert.Throws<SupervisorException>(() => ProtocolValidator.ValidateContiguous(2, 1));
        ProtocolValidator.ValidateContiguous(2, 2);
    }

    [Fact]
    public void NegativeSeqRejected()
    {
        var json = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":-1,\"kind\":\"command\",\"type\":\"pause\",\"payload\":{}}");
        Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(json));
    }

    [Fact]
    public void UnknownCommandRejected()
    {
        var json = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"command\",\"type\":\"explode\",\"payload\":{}}");
        Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(json));
    }

    [Fact]
    public void JobIdMismatch()
    {
        var json = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"event\",\"type\":\"accepted\",\"payload\":{}}");
        var env = IpcCodec.DecodeUtf8(json);
        Assert.Throws<SupervisorException>(() => ProtocolValidator.ValidateJobId(env, "b"));
    }

    [Fact]
    public void InvalidJsonRejected()
    {
        var json = Encoding.UTF8.GetBytes("{not json");
        var ex = Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(json));
        Assert.Equal(SupervisorErrorCode.InvalidJson, ex.Code);
    }

    [Fact]
    public void MissingSeqRejected()
    {
        var json = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"kind\":\"command\",\"type\":\"pause\",\"payload\":{}}");
        Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(json));
    }

    [Fact]
    public void SequenceGapRejected()
    {
        Assert.Throws<SupervisorException>(() => ProtocolValidator.ValidateContiguous(3, 5));
    }

    [Fact]
    public void KindAndTypeMustBeStrings()
    {
        var kindNum = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":1,\"type\":\"pause\",\"payload\":{}}");
        var typeBool = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"command\",\"type\":true,\"payload\":{}}");
        var kex = Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(kindNum));
        var tex = Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(typeBool));
        Assert.Equal(SupervisorErrorCode.EnvelopeInvalid, kex.Code);
        Assert.Equal(SupervisorErrorCode.EnvelopeInvalid, tex.Code);
    }

    [Fact]
    public void AckRequiresNonNegativeIntegerCommandSeq()
    {
        var missing = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"event\",\"type\":\"accepted\",\"payload\":{}}");
        var asString = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"event\",\"type\":\"accepted\",\"payload\":{\"command_seq\":\"0\"}}");
        var asFloat = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"event\",\"type\":\"accepted\",\"payload\":{\"command_seq\":1.5}}");
        var negative = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"event\",\"type\":\"accepted\",\"payload\":{\"command_seq\":-1}}");
        var nully = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"event\",\"type\":\"accepted\",\"payload\":{\"command_seq\":null}}");
        Assert.Equal(SupervisorErrorCode.EnvelopeInvalid, Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(missing)).Code);
        Assert.Equal(SupervisorErrorCode.EnvelopeInvalid, Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(asString)).Code);
        Assert.Equal(SupervisorErrorCode.EnvelopeInvalid, Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(asFloat)).Code);
        Assert.Equal(SupervisorErrorCode.EnvelopeInvalid, Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(negative)).Code);
        Assert.Equal(SupervisorErrorCode.EnvelopeInvalid, Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(nully)).Code);
    }

    [Fact]
    public void AckCorrelationMatchesExpectedSeq()
    {
        var json = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"event\",\"type\":\"paused\",\"payload\":{\"command_seq\":3}}");
        var env = IpcCodec.DecodeUtf8(json);
        Assert.True(ProtocolValidator.AckMatches(env.Payload, 3));
        Assert.False(ProtocolValidator.AckMatches(env.Payload, 999));
        Assert.Equal(3, ProtocolValidator.RequireCommandSeq(env.Payload));
    }

    [Fact]
    public void HeartbeatPayloadTypesRequired()
    {
        var ok = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"event\",\"type\":\"heartbeat\",\"payload\":{\"uptime_ms\":10,\"state\":\"paused\"}}");
        Assert.Equal("heartbeat", IpcCodec.DecodeUtf8(ok).Type);
        var badState = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"event\",\"type\":\"heartbeat\",\"payload\":{\"uptime_ms\":10,\"state\":\"runningg\"}}");
        var missingUp = Encoding.UTF8.GetBytes("{\"protocol_version\":1,\"job_id\":\"a\",\"seq\":0,\"kind\":\"event\",\"type\":\"heartbeat\",\"payload\":{\"state\":\"running\"}}");
        Assert.Equal(SupervisorErrorCode.EnvelopeInvalid, Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(badState)).Code);
        Assert.Equal(SupervisorErrorCode.EnvelopeInvalid, Assert.Throws<SupervisorException>(() => IpcCodec.DecodeUtf8(missingUp)).Code);
    }
}
