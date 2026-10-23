fn main() {
    slint_build::compile("ui/main.slint")
        .expect("failed to compile the Zenime Slint UI");
}
