tolk 1.2

struct Storage {
    message: cell;
}

// read the storage struct from persistent storage
fun Storage.load() {
    return Storage.fromCell(contract.getData());
}

// write the storage struct back to persistent storage
fun Storage.save(self) {
    contract.setData(self.toCell());
}

struct(0x00000001) UpdateMessage {
    message: cell;
}

type AllowedMessage = UpdateMessage;

// return the current message off-chain
get fun message(): slice {
    val storage = lazy Storage.load();
    return storage.message.beginParse();
}

// read the op code and route to the right contract action
fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessage.fromSlice(in.body);
    match (msg) {
        UpdateMessage => {
            var storage = lazy Storage.load();
            storage.message = msg.message;
            storage.save();
        }
        else => {
            assert(in.body.isEmpty()) throw 0xFFFF;
        }
    }
}